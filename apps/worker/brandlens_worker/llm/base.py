"""Provider interface, metadata and error taxonomy shared by Groq, Gemini and the router."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class Meta(BaseModel):
    provider: str
    model: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    cache_hit: bool = False
    validation_retries: int = 0


@dataclass(frozen=True)
class Image:
    data: bytes
    mime_type: str = "image/png"


@dataclass(frozen=True)
class RawCompletion:
    text: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class ProviderError(Exception):
    """Base for provider failures. `retryable` errors get backoff; others go to the fallback."""

    retryable = False

    def __init__(self, provider: str, message: str, *, retry_after: float | None = None) -> None:
        super().__init__(f"{provider}: {message}")
        self.provider = provider
        self.retry_after = retry_after


class RateLimited(ProviderError):
    retryable = True


class TransientError(ProviderError):
    """5xx, timeouts, connection resets."""

    retryable = True


class ModelUnavailable(ProviderError):
    """The configured model doesn't exist or isn't enabled. The message names the env var."""


class InvalidOutput(ProviderError):
    """Output still failed schema validation after the one validation retry."""


class DegradedError(Exception):
    """Every provider failed. Callers return deterministic findings only (`degraded = true`)."""


class LLMProvider(Protocol):
    name: str

    def model_for(self, *, vision: bool) -> str: ...

    async def generate_structured(
        self,
        system: str,
        user: str,
        schema: type[T],
        *,
        vision_images: list[Image] | None = None,
        temperature: float = 0.2,
    ) -> tuple[T, Meta]: ...


_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def extract_json(text: str) -> str:
    """Strip code fences and leading prose some models add around JSON."""
    cleaned = _FENCE.sub("", text.strip())
    start = min((i for i in (cleaned.find("{"), cleaned.find("[")) if i >= 0), default=-1)
    return cleaned[start:] if start > 0 else cleaned


def schema_instruction(schema: type[BaseModel]) -> str:
    return (
        "Respond with a single JSON object only, no prose and no code fences. "
        "It must validate against this JSON Schema:\n"
        + json.dumps(schema.model_json_schema(), separators=(",", ":"))
    )


class BaseProvider:
    """Shared `generate_structured`: call `_complete`, validate, retry once with the error."""

    name = "base"

    def model_for(self, *, vision: bool) -> str:  # pragma: no cover - abstract
        raise NotImplementedError

    async def _complete(
        self,
        system: str,
        user: str,
        schema: type[BaseModel],
        *,
        model: str,
        images: list[Image] | None,
        temperature: float,
    ) -> RawCompletion:  # pragma: no cover - abstract
        raise NotImplementedError

    async def generate_structured(
        self,
        system: str,
        user: str,
        schema: type[T],
        *,
        vision_images: list[Image] | None = None,
        temperature: float = 0.2,
    ) -> tuple[T, Meta]:
        model = self.model_for(vision=bool(vision_images))
        started = time.perf_counter()
        raw = await self._complete(
            system, user, schema, model=model, images=vision_images, temperature=temperature
        )
        retries = 0
        try:
            parsed = schema.model_validate_json(extract_json(raw.text))
        except ValidationError as exc:
            retries = 1
            correction = (
                f"{user}\n\nYour previous reply was not valid. Validation errors:\n"
                f"{_short_errors(exc)}\nReturn corrected JSON only."
            )
            raw = await self._complete(
                system,
                correction,
                schema,
                model=model,
                images=vision_images,
                temperature=temperature,
            )
            try:
                parsed = schema.model_validate_json(extract_json(raw.text))
            except ValidationError as exc2:
                raise InvalidOutput(
                    self.name, f"invalid JSON after retry: {_short_errors(exc2)}"
                ) from None
        meta = Meta(
            provider=self.name,
            model=raw.model or model,
            latency_ms=round((time.perf_counter() - started) * 1000),
            input_tokens=raw.input_tokens,
            output_tokens=raw.output_tokens,
            validation_retries=retries,
        )
        return parsed, meta


def _short_errors(exc: ValidationError, limit: int = 8) -> str:
    # Field paths and messages only; never echo the model's raw output (it may quote the draft).
    lines = [
        f"- {'.'.join(str(p) for p in e['loc']) or '(root)'}: {e['msg']}"
        for e in exc.errors(include_input=False, include_url=False)[:limit]
    ]
    return "\n".join(lines)
