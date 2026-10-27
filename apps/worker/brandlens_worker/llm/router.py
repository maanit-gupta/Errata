"""Provider router: LLM_PROVIDER → LLM_FALLBACK_PROVIDER → DegradedError (SPEC §13).

Each provider gets up to 3 attempts with exponential backoff on 429/5xx/timeouts, honouring
Retry-After. Non-retryable errors (bad model, invalid output after the validation retry) move
straight to the fallback. A provider that is still rate-limited after its retries cools down: calls
skip it until the cool-down ends (P15 load test: without this, every queued job sat through the
same backoff before going degraded).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from tenacity import AsyncRetrying, RetryCallState, retry_if_exception, stop_after_attempt

from brandlens_worker import config
from brandlens_worker.llm.base import (
    DegradedError,
    Image,
    LLMProvider,
    Meta,
    ProviderError,
    RateLimited,
    T,
)
from brandlens_worker.llm.cache import LLMCache, cache_key

log = logging.getLogger(__name__)

Sleep = Callable[[float], Awaitable[None]]


def _retryable(exc: BaseException) -> bool:
    return isinstance(exc, ProviderError) and exc.retryable


class LLMRouter:
    def __init__(
        self,
        providers: Sequence[LLMProvider],
        *,
        cache: LLMCache | None = None,
        max_attempts: int = 3,
        max_wait_s: float = 20.0,
        sleep: Sleep = asyncio.sleep,
        cooldown_s: float = 0.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if not providers:
            raise ValueError("at least one provider is required")
        self.providers = list(providers)
        self.cache = cache or LLMCache()
        self.max_attempts = max_attempts
        self.max_wait_s = max_wait_s
        self._sleep = sleep
        self.cooldown_s = cooldown_s
        self._clock = clock
        self._cooling_until: dict[str, float] = {}

    def _wait(self, state: RetryCallState) -> float:
        exc = state.outcome.exception() if state.outcome else None
        if isinstance(exc, ProviderError) and exc.retry_after is not None:
            return min(exc.retry_after, self.max_wait_s)
        return float(min(2 ** (state.attempt_number - 1), self.max_wait_s))

    async def generate(
        self,
        system: str,
        user: str,
        schema: type[T],
        *,
        prompt_version: str,
        vision_images: list[Image] | None = None,
        temperature: float = 0.2,
    ) -> tuple[T, Meta]:
        payload: dict[str, Any] = {
            "system": system,
            "user": user,
            "schema": schema.model_json_schema(),
            "temperature": temperature,
            "images": [hashlib.sha256(i.data).hexdigest() for i in vision_images or []],
        }
        keys = [
            cache_key(p.name, p.model_for(vision=bool(vision_images)), prompt_version, payload)
            for p in self.providers
        ]
        # Every provider's cache entry is checked before any live call, so a response recorded
        # from the fallback is replayed instead of calling the primary again (eval/CI determinism).
        for key in keys:
            cached = self.cache.get(key)
            if cached is not None:
                parsed = schema.model_validate(cached["output"])
                meta = Meta.model_validate({**cached["meta"], "cache_hit": True, "latency_ms": 0})
                return parsed, meta

        failures: list[str] = []
        for provider, key in zip(self.providers, keys, strict=True):
            model = provider.model_for(vision=bool(vision_images))
            if self._clock() < self._cooling_until.get(provider.name, 0.0):
                failures.append(f"{provider.name}: rate-limited (cooling down)")
                continue
            try:
                result = await self._call_with_retries(
                    provider, system, user, schema, vision_images, temperature
                )
            except ProviderError as exc:
                failures.append(str(exc))
                if isinstance(exc, RateLimited) and self.cooldown_s > 0:
                    wait = max(self.cooldown_s, exc.retry_after or 0.0)
                    self._cooling_until[provider.name] = self._clock() + wait
                log.warning(
                    "llm provider failed; trying next",
                    extra={"provider": provider.name, "model": model, "error": type(exc).__name__},
                )
                continue
            except Exception as exc:  # unexpected SDK behaviour: treat as a provider failure
                failures.append(f"{provider.name}: {type(exc).__name__}")
                log.exception("llm provider crashed", extra={"provider": provider.name})
                continue

            parsed, meta = result
            self.cache.put(
                key, {"output": parsed.model_dump(mode="json"), "meta": meta.model_dump()}
            )
            return parsed, meta

        raise DegradedError("; ".join(failures) or "no providers succeeded")

    async def _call_with_retries(
        self,
        provider: LLMProvider,
        system: str,
        user: str,
        schema: type[T],
        images: list[Image] | None,
        temperature: float,
    ) -> tuple[T, Meta]:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self.max_attempts),
            retry=retry_if_exception(_retryable),
            wait=self._wait,
            sleep=self._sleep,
            reraise=True,
        ):
            with attempt:
                return await provider.generate_structured(
                    system, user, schema, vision_images=images, temperature=temperature
                )
        raise AssertionError("unreachable")  # pragma: no cover


def build_router(settings: Any, *, cache: LLMCache | None = None) -> LLMRouter:
    """Providers in configured order. Imports SDKs lazily so tests don't need them configured."""
    from brandlens_worker.llm.gemini_provider import GeminiProvider
    from brandlens_worker.llm.groq_provider import GroqProvider

    def make(name: str) -> LLMProvider:
        if name == "groq":
            return GroqProvider(
                settings.groq_api_key.get_secret_value(),
                settings.groq_model_text,
                settings.groq_model_vision,
            )
        return GeminiProvider(
            settings.gemini_api_key.get_secret_value(),
            settings.gemini_model_text,
            settings.gemini_model_vision,
        )

    names = [settings.llm_provider]
    if settings.llm_fallback_provider not in ("none", settings.llm_provider):
        names.append(settings.llm_fallback_provider)
    return LLMRouter(
        [make(n) for n in names], cache=cache, cooldown_s=config.LLM_RATE_LIMIT_COOLDOWN_S
    )
