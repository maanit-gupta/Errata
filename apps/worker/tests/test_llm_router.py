from pathlib import Path

import pytest

from brandlens_worker.llm.base import (
    DegradedError,
    InvalidOutput,
    ModelUnavailable,
    RateLimited,
    TransientError,
)
from brandlens_worker.llm.cache import LLMCache
from brandlens_worker.llm.router import LLMRouter
from tests.fakes import Answer, RawProvider, ScriptedProvider

GOOD = {"brand": "PayWise", "word_count": 7}


class Sleeps:
    def __init__(self) -> None:
        self.waits: list[float] = []

    async def __call__(self, seconds: float) -> None:
        self.waits.append(seconds)


def router(
    *providers: ScriptedProvider, cache: LLMCache | None = None, sleeps: Sleeps | None = None
) -> LLMRouter:
    return LLMRouter(
        list(providers),
        cache=cache or LLMCache(enabled=False),
        sleep=sleeps or Sleeps(),
    )


async def test_primary_success_skips_fallback() -> None:
    primary = ScriptedProvider("groq", [GOOD])
    fallback = ScriptedProvider("gemini", [GOOD])
    out, meta = await router(primary, fallback).generate("s", "u", Answer, prompt_version="smoke@1")
    assert out.brand == "PayWise"
    assert meta.provider == "groq"
    assert fallback.calls == 0


async def test_primary_429_falls_back_after_retries() -> None:
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3)
    fallback = ScriptedProvider("gemini", [GOOD])
    sleeps = Sleeps()
    out, meta = await router(primary, fallback, sleeps=sleeps).generate(
        "s", "u", Answer, prompt_version="smoke@1"
    )
    assert meta.provider == "gemini"
    assert primary.calls == 3  # max 3 attempts
    assert sleeps.waits == [1.0, 2.0]  # exponential backoff between attempts
    assert out.word_count == 7


async def test_retry_after_is_respected() -> None:
    primary = ScriptedProvider("groq", [RateLimited("groq", "429", retry_after=7.5), GOOD])
    sleeps = Sleeps()
    _, meta = await router(primary, sleeps=sleeps).generate(
        "s", "u", Answer, prompt_version="smoke@1"
    )
    assert meta.provider == "groq"
    assert sleeps.waits == [7.5]


async def test_transient_error_recovers_on_same_provider() -> None:
    primary = ScriptedProvider("groq", [TransientError("groq", "503"), GOOD])
    _, meta = await router(primary).generate("s", "u", Answer, prompt_version="smoke@1")
    assert meta.provider == "groq"
    assert primary.calls == 2


async def test_non_retryable_error_goes_straight_to_fallback() -> None:
    primary = ScriptedProvider("groq", [ModelUnavailable("groq", "change GROQ_MODEL_TEXT")])
    fallback = ScriptedProvider("gemini", [GOOD])
    sleeps = Sleeps()
    _, meta = await router(primary, fallback, sleeps=sleeps).generate(
        "s", "u", Answer, prompt_version="smoke@1"
    )
    assert primary.calls == 1
    assert sleeps.waits == []
    assert meta.provider == "gemini"


async def test_both_fail_raises_degraded() -> None:
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3)
    fallback = ScriptedProvider("gemini", [InvalidOutput("gemini", "bad")])
    with pytest.raises(DegradedError) as exc:
        await router(primary, fallback).generate("s", "u", Answer, prompt_version="smoke@1")
    assert "groq" in str(exc.value) and "gemini" in str(exc.value)


async def test_rate_limited_provider_cools_down_then_recovers() -> None:
    now = [0.0]
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3 + [GOOD])
    fallback = ScriptedProvider("gemini", [GOOD, GOOD])
    r = LLMRouter(
        [primary, fallback],
        cache=LLMCache(enabled=False),
        sleep=Sleeps(),
        cooldown_s=60,
        clock=lambda: now[0],
    )
    assert (await r.generate("s", "u", Answer, prompt_version="smoke@1"))[1].provider == "gemini"
    now[0] = 30  # still cooling: the next job goes straight to the fallback
    assert (await r.generate("s", "u2", Answer, prompt_version="smoke@1"))[1].provider == "gemini"
    assert primary.calls == 3
    now[0] = 61  # cool-down over: the primary is tried again
    assert (await r.generate("s", "u3", Answer, prompt_version="smoke@1"))[1].provider == "groq"
    assert primary.calls == 4


async def test_all_providers_cooling_degrades_without_calls() -> None:
    primary = ScriptedProvider("groq", [RateLimited("groq", "429", retry_after=90)] * 3)
    fallback = ScriptedProvider("gemini", [RateLimited("gemini", "429")] * 3)
    r = LLMRouter(
        [primary, fallback],
        cache=LLMCache(enabled=False),
        sleep=Sleeps(),
        cooldown_s=60,
        clock=lambda: 0.0,
    )
    with pytest.raises(DegradedError):
        await r.generate("s", "u", Answer, prompt_version="smoke@1")
    with pytest.raises(DegradedError, match="cooling down"):
        await r.generate("s", "u2", Answer, prompt_version="smoke@1")
    assert (primary.calls, fallback.calls) == (3, 3)


async def test_validation_retry_appends_error_and_succeeds() -> None:
    provider = RawProvider(
        ['{"brand": "PayWise"}', '```json\n{"brand": "PayWise", "word_count": 7}\n```']
    )
    out, meta = await provider.generate_structured("s", "<draft>x</draft>", Answer)
    assert out.word_count == 7
    assert meta.validation_retries == 1
    assert len(provider.users) == 2
    assert "word_count" in provider.users[1] and "Validation errors" in provider.users[1]
    # the model's raw output is never echoed back
    assert '{"brand": "PayWise"}' not in provider.users[1]


async def test_validation_fails_twice_raises_invalid_output() -> None:
    provider = RawProvider(["not json", '{"brand": 1}'])
    with pytest.raises(InvalidOutput):
        await provider.generate_structured("s", "u", Answer)


async def test_invalid_output_falls_back_via_router() -> None:
    primary = RawProvider(["nope", "still nope"])
    fallback = ScriptedProvider("gemini", [GOOD])
    _, meta = await LLMRouter([primary, fallback], cache=LLMCache(enabled=False)).generate(
        "s", "u", Answer, prompt_version="smoke@1"
    )
    assert meta.provider == "gemini"


async def test_cache_miss_then_hit(tmp_path: Path) -> None:
    cache = LLMCache(tmp_path, enabled=True)
    primary = ScriptedProvider("groq", [GOOD])
    r = router(primary, cache=cache)
    _, first = await r.generate("s", "u", Answer, prompt_version="smoke@1")
    out, second = await r.generate("s", "u", Answer, prompt_version="smoke@1")
    assert first.cache_hit is False
    assert second.cache_hit is True
    assert out.brand == "PayWise"
    assert primary.calls == 1
    assert len(list(tmp_path.glob("*.json"))) == 1


async def test_cache_key_changes_with_prompt_version(tmp_path: Path) -> None:
    cache = LLMCache(tmp_path, enabled=True)
    primary = ScriptedProvider("groq", [GOOD, GOOD])
    r = router(primary, cache=cache)
    await r.generate("s", "u", Answer, prompt_version="smoke@1")
    _, meta = await r.generate("s", "u", Answer, prompt_version="smoke@2")
    assert meta.cache_hit is False
    assert primary.calls == 2


async def test_disabled_cache_never_writes(tmp_path: Path) -> None:
    primary = ScriptedProvider("groq", [GOOD, GOOD])
    r = router(primary, cache=LLMCache(tmp_path, enabled=False))
    await r.generate("s", "u", Answer, prompt_version="smoke@1")
    await r.generate("s", "u", Answer, prompt_version="smoke@1")
    assert primary.calls == 2
    assert list(tmp_path.iterdir()) == []


async def test_cached_fallback_response_replays_without_calling_primary(tmp_path: Path) -> None:
    cache = LLMCache(tmp_path, enabled=True)
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3)
    fallback = ScriptedProvider("gemini", [GOOD])
    await router(primary, fallback, cache=cache).generate(
        "s", "u", Answer, prompt_version="smoke@1"
    )
    primary.calls = 0
    _, meta = await router(primary, fallback, cache=cache).generate(
        "s", "u", Answer, prompt_version="smoke@1"
    )
    assert meta.provider == "gemini"
    assert meta.cache_hit is True
    assert primary.calls == 0  # eval/CI replay is deterministic even after a fallback


# --- R3: transient vs permanent failures (decides "AI check pending" vs degraded) ---------------


async def test_all_rate_limited_is_transient() -> None:
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3)
    fallback = ScriptedProvider("gemini", [TransientError("gemini", "503")] * 3)
    with pytest.raises(DegradedError) as exc:
        await router(primary, fallback).generate("s", "u", Answer, prompt_version="smoke@1")
    assert exc.value.transient is True


async def test_a_permanent_failure_is_not_transient() -> None:
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3)
    fallback = ScriptedProvider("gemini", [ModelUnavailable("gemini", "set GEMINI_MODEL_TEXT")])
    with pytest.raises(DegradedError) as exc:
        await router(primary, fallback).generate("s", "u", Answer, prompt_version="smoke@1")
    assert exc.value.transient is False


async def test_invalid_output_and_crashes_are_not_transient() -> None:
    bad = ScriptedProvider("groq", [InvalidOutput("groq", "schema")])
    with pytest.raises(DegradedError) as exc:
        await router(bad).generate("s", "u", Answer, prompt_version="smoke@1")
    assert exc.value.transient is False
    crash = ScriptedProvider("groq", [RuntimeError("sdk bug")])
    with pytest.raises(DegradedError) as exc:
        await router(crash).generate("s", "u", Answer, prompt_version="smoke@1")
    assert exc.value.transient is False


async def test_cooling_provider_counts_as_transient() -> None:
    now = [0.0]
    primary = ScriptedProvider("groq", [RateLimited("groq", "429")] * 3)
    r = LLMRouter(
        [primary], cache=LLMCache(enabled=False), sleep=Sleeps(), cooldown_s=60,
        clock=lambda: now[0],
    )  # fmt: skip
    with pytest.raises(DegradedError):
        await r.generate("s", "u", Answer, prompt_version="smoke@1")
    with pytest.raises(DegradedError) as exc:  # skipped without a call while cooling
        await r.generate("s", "u", Answer, prompt_version="smoke@1")
    assert exc.value.transient is True and primary.calls == 3
