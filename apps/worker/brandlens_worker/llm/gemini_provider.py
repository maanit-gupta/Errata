"""Gemini provider (google-genai). Structured output via `response_json_schema`, falling back to
JSON mode with the schema in the prompt if a model rejects the schema. Model IDs come from env."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from brandlens_worker.llm.base import (
    BaseProvider,
    Image,
    ModelUnavailable,
    ProviderError,
    RateLimited,
    RawCompletion,
    TransientError,
    schema_instruction,
)

log = logging.getLogger(__name__)


def _retry_after(exc: genai_errors.APIError) -> float | None:
    """Read google.rpc.RetryInfo.retryDelay (e.g. "17s") from the error details, if present."""
    details: Any = exc.details
    error = details.get("error", details) if isinstance(details, dict) else {}
    for item in error.get("details", []) if isinstance(error, dict) else []:
        delay = item.get("retryDelay") if isinstance(item, dict) else None
        if isinstance(delay, str) and delay.endswith("s"):
            try:
                return float(delay[:-1])
            except ValueError:
                return None
    return None


class GeminiProvider(BaseProvider):
    name = "gemini"

    def __init__(
        self, api_key: str, text_model: str, vision_model: str, *, timeout_s: float = 30.0
    ) -> None:
        self._client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000))
        )
        self._text_model = text_model
        self._vision_model = vision_model
        self._json_mode_only: set[str] = set()

    def model_for(self, *, vision: bool) -> str:
        return self._vision_model if vision else self._text_model

    def _env_var(self, model: str) -> str:
        # Text and vision may share one model id; the text slot is the one to change then.
        if model == self._text_model:
            return "GEMINI_MODEL_TEXT"
        return "GEMINI_MODEL_VISION"

    async def _complete(
        self,
        system: str,
        user: str,
        schema: type[BaseModel],
        *,
        model: str,
        images: list[Image] | None,
        temperature: float,
    ) -> RawCompletion:
        parts: list[Any] = [types.Part.from_text(text=user)]
        for img in images or []:
            parts.append(types.Part.from_bytes(data=img.data, mime_type=img.mime_type))
        contents = [types.Content(role="user", parts=parts)]

        if model not in self._json_mode_only:
            config = types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
                response_mime_type="application/json",
                response_json_schema=schema.model_json_schema(),
            )
            try:
                return await self._call(model, contents, config)
            except genai_errors.ClientError as exc:
                if exc.code != 400 or "schema" not in str(exc).lower():
                    raise self._map(exc, model) from None
                log.info("gemini model rejected schema; using json mode", extra={"model": model})
                self._json_mode_only.add(model)

        config = types.GenerateContentConfig(
            system_instruction=f"{system}\n\n{schema_instruction(schema)}",
            temperature=temperature,
            response_mime_type="application/json",
        )
        try:
            return await self._call(model, contents, config)
        except genai_errors.APIError as exc:
            raise self._map(exc, model) from None

    async def _call(
        self, model: str, contents: list[Any], config: types.GenerateContentConfig
    ) -> RawCompletion:
        try:
            resp = await self._client.aio.models.generate_content(
                model=model, contents=contents, config=config
            )
        except genai_errors.ServerError as exc:
            raise TransientError(self.name, f"server error ({exc.code})") from None
        except genai_errors.ClientError as exc:
            if exc.code == 400:
                raise  # let _complete decide whether it's a schema problem
            raise self._map(exc, model) from None
        except (httpx.TimeoutException, httpx.TransportError):
            raise TransientError(self.name, "connection error or timeout") from None

        usage = resp.usage_metadata
        return RawCompletion(
            text=resp.text or "",
            model=resp.model_version or model,
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
        )

    def _map(self, exc: genai_errors.APIError, model: str) -> ProviderError:
        if exc.code == 429:
            return RateLimited(self.name, "rate limited (429)", retry_after=_retry_after(exc))
        if exc.code == 404:
            return ModelUnavailable(
                self.name, f"model {model!r} not found; change {self._env_var(model)}"
            )
        if isinstance(exc, genai_errors.ServerError) or (exc.code or 0) >= 500:
            return TransientError(self.name, f"server error ({exc.code})")
        return ProviderError(self.name, f"HTTP {exc.code}")
