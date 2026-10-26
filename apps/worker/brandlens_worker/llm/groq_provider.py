"""Groq provider. JSON-schema response format where the model supports it, otherwise JSON mode with
the schema in the system prompt (CLAUDE.md gotcha). Model IDs come from env, never hardcoded."""

from __future__ import annotations

import base64
import logging
from typing import Any

import groq
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


def _retry_after(exc: groq.APIStatusError) -> float | None:
    value = exc.response.headers.get("retry-after")
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


def _is_schema_unsupported(exc: groq.BadRequestError) -> bool:
    text = str(exc).lower()
    return "json_schema" in text or "response_format" in text or "structured" in text


class GroqProvider(BaseProvider):
    name = "groq"

    def __init__(
        self, api_key: str, text_model: str, vision_model: str, *, timeout_s: float = 30.0
    ) -> None:
        self._client = groq.AsyncGroq(api_key=api_key, timeout=timeout_s, max_retries=0)
        self._text_model = text_model
        self._vision_model = vision_model
        # Models that rejected json_schema mode; remembered for the process lifetime.
        self._json_mode_only: set[str] = set()

    def model_for(self, *, vision: bool) -> str:
        return self._vision_model if vision else self._text_model

    def _env_var(self, model: str) -> str:
        # Text and vision may share one model id; the text slot is the one to change then.
        if model == self._text_model:
            return "GROQ_MODEL_TEXT"
        return "GROQ_MODEL_VISION"

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
        user_content: Any = user
        if images:
            user_content = [{"type": "text", "text": user}] + [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{img.mime_type};base64,{base64.b64encode(img.data).decode()}"
                    },
                }
                for img in images
            ]

        if model not in self._json_mode_only:
            try:
                return await self._call(
                    model,
                    [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_content},
                    ],
                    temperature,
                    {
                        "type": "json_schema",
                        "json_schema": {
                            "name": schema.__name__,
                            "schema": schema.model_json_schema(),
                        },
                    },
                )
            except groq.BadRequestError as exc:
                if not _is_schema_unsupported(exc):
                    raise ProviderError(self.name, f"bad request ({exc.status_code})") from None
                log.info("groq model lacks json_schema; using json mode", extra={"model": model})
                self._json_mode_only.add(model)

        return await self._call(
            model,
            [
                {"role": "system", "content": f"{system}\n\n{schema_instruction(schema)}"},
                {"role": "user", "content": user_content},
            ],
            temperature,
            {"type": "json_object"},
        )

    async def _call(
        self,
        model: str,
        messages: list[dict[str, Any]],
        temperature: float,
        response_format: dict[str, Any],
    ) -> RawCompletion:
        try:
            resp = await self._client.chat.completions.create(  # type: ignore[call-overload]
                model=model,
                messages=messages,
                temperature=temperature,
                response_format=response_format,
            )
        except groq.RateLimitError as exc:
            raise RateLimited(
                self.name, "rate limited (429)", retry_after=_retry_after(exc)
            ) from None
        except groq.NotFoundError:
            raise ModelUnavailable(
                self.name, f"model {model!r} not found; change {self._env_var(model)}"
            ) from None
        except groq.BadRequestError as exc:
            if "model" in str(exc).lower() and "decommissioned" in str(exc).lower():
                raise ModelUnavailable(
                    self.name, f"model {model!r} is decommissioned; change {self._env_var(model)}"
                ) from None
            raise
        except groq.InternalServerError as exc:
            raise TransientError(self.name, f"server error ({exc.status_code})") from None
        except groq.APIStatusError as exc:
            if exc.status_code >= 500:
                raise TransientError(self.name, f"server error ({exc.status_code})") from None
            raise ProviderError(self.name, f"HTTP {exc.status_code}") from None
        except groq.APIConnectionError:  # includes APITimeoutError
            raise TransientError(self.name, "connection error or timeout") from None

        choice = resp.choices[0]
        usage = resp.usage
        return RawCompletion(
            text=choice.message.content or "",
            model=resp.model or model,
            input_tokens=usage.prompt_tokens if usage else None,
            output_tokens=usage.completion_tokens if usage else None,
        )
