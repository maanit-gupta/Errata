"""R3 "AI check pending": the retry schedule (pure) and, against a real Postgres, the whole flow.

The DB tests run the real `review_version` job through `process_message` and pgmq with a fake
rate-limited LLM. They need a database with every migration and seed.sql applied (local Supabase,
or plain Postgres + pgvector + pgmq) and are skipped unless TEST_DATABASE_URL is set:

    TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres uv run pytest \
        tests/test_llm_pending.py
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator, Sequence
from typing import Any

import numpy as np
import pytest

from brandlens_worker import config
from brandlens_worker.jobs import build_registry
from brandlens_worker.jobs.review_version import next_retry_delay
from brandlens_worker.llm.base import DegradedError, ModelUnavailable, RateLimited
from brandlens_worker.llm.cache import LLMCache
from brandlens_worker.llm.router import LLMRouter
from brandlens_worker.queue import PgmqBackend, process_message
from tests.fakes import ScriptedProvider
from tests.vault_fixture import HERO

# --- pure ------------------------------------------------------------------------------------


def test_retry_schedule() -> None:
    rate_limited = DegradedError("groq: 429", transient=True)
    delays = config.LLM_PENDING_RETRY_DELAYS_S
    assert delays[0] >= config.LLM_RATE_LIMIT_COOLDOWN_S
    assert [next_retry_delay(rate_limited, i) for i in range(len(delays))] == list(delays)
    assert next_retry_delay(rate_limited, len(delays)) is None  # out of attempts → degraded
    assert next_retry_delay(DegradedError("bad model", transient=False), 0) is None
    assert next_retry_delay(None, 0) is None  # the LLM answered


# --- DB integration ----------------------------------------------------------------------------

DB = os.environ.get("TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not DB, reason="set TEST_DATABASE_URL (see module docstring)")

ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
CREATOR = "10000000-0000-4000-8000-000000000002"
QUEUE = "review_jobs"
TITLE = "[pytest llm_pending] "
INTENT = {
    "goal": "webinar sign-ups",
    "audience": "first-time investors",
    "cta": "Register now",
    "channel": "instagram_caption",
    "campaign_id": DIWALI,
}
# One LLM finding that passes the real gate: TV-02 is retrieved (see `aligned_vault`) and the quote
# is in HERO.
LLM_OK = {
    "findings": [
        {
            "dimension": "tone",
            "cites": ["TV-02"],
            "quote": "lock in 14.2% assured annual returns",
            "severity": "suggestion",
            "explanation": "Breathless promise; keep it calm.",
            "self_confidence": 0.9,
        }
    ]
}


class UnitEmbedder:
    """Every text embeds to e0, so match_vault ranks TV-02 (embedded as e0) first."""

    def embed(self, texts: Sequence[str]) -> Any:
        out = np.zeros((len(texts), 384), dtype=np.float32)
        out[:, 0] = 1.0
        return out


def make_router(*steps: Any) -> tuple[LLMRouter, ScriptedProvider]:
    provider = ScriptedProvider("groq", list(steps))
    return LLMRouter([provider], cache=LLMCache(enabled=False), max_attempts=1), provider


@pytest.fixture
async def pool() -> AsyncIterator[Any]:
    from brandlens_worker.db import create_pool

    p = create_pool(DB or "", max_size=4)
    await p.open()
    async with p.connection() as conn:
        e0 = "[" + ",".join("1" if i == 0 else "0" for i in range(384)) + "]"
        e1 = "[" + ",".join("1" if i == 1 else "0" for i in range(384)) + "]"
        await conn.execute(
            "update public.rule_cards set embedding = case when code = 'TV-02' "
            "then %s::extensions.vector else %s::extensions.vector end where org_id = %s",
            (e0, e1, ORG),
        )
        await conn.execute(
            "update public.facts set embedding = %s::extensions.vector where org_id = %s",
            (e1, ORG),
        )
        await conn.execute("select pgmq.purge_queue(%s)", (QUEUE,))
        await conn.execute("delete from private.rate_counters where user_id = %s", (CREATOR,))
    yield p
    async with p.connection() as conn:
        await conn.execute("delete from public.contents where title like %s", (TITLE + "%",))
        await conn.execute("select pgmq.purge_queue(%s)", (QUEUE,))
    await p.close()


async def submit(pool: Any) -> str:
    """Create a draft and submit it exactly as the web does (enqueue_review as the creator)."""
    async with pool.connection() as conn:
        cid = str(uuid.uuid4())
        await conn.execute(
            "insert into public.contents (id, org_id, campaign_id, owner_id, title, channel) "
            "values (%s, %s, %s, %s, %s, 'instagram_post')",
            (cid, ORG, DIWALI, CREATOR, TITLE + cid[:8]),
        )
        cur = await conn.execute(
            "insert into public.versions (content_id, n, body, format, intent) "
            "values (%s, 1, %s, 'text', %s) returning id",
            (cid, HERO, __import__("json").dumps(INTENT)),
        )
        vid = (await cur.fetchone())["id"]
        await conn.execute(
            "update public.contents set current_version_id = %s where id = %s", (vid, cid)
        )
        async with conn.transaction():
            await conn.execute(
                "select set_config('request.jwt.claims', %s, true)",
                (f'{{"sub":"{CREATOR}","role":"authenticated"}}',),
            )
            await conn.execute("select public.enqueue_review(%s)", (vid,))
    return cid


async def work_one(pool: Any, router: LLMRouter, *, make_visible: bool = False) -> str | None:
    """One worker iteration: read the next message (optionally pulling a delayed retry forward)."""
    backend = PgmqBackend(pool)
    if make_visible:
        async with pool.connection() as conn:
            await conn.execute("update pgmq.q_review_jobs set vt = now() where vt > now()")
    msg = await backend.read(QUEUE, 30, 1)
    if msg is None:
        return None
    services = {"router": router, "embedder": UnitEmbedder()}
    return await process_message(
        QUEUE, msg, backend=backend, registry=build_registry(), pool=pool, services=services
    )


async def run_of(pool: Any, cid: str) -> dict[str, Any]:
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select r.*, c.state::text as content_state, "
            "(select count(*) from public.findings f where f.run_id = r.id) as n, "
            "(select count(*) from public.findings f where f.run_id = r.id and f.source = 'llm') "
            "as n_llm "
            "from public.review_runs r join public.versions v on v.id = r.version_id "
            "join public.contents c on c.id = v.content_id where c.id = %s",
            (cid,),
        )
        row: dict[str, Any] = await cur.fetchone()
        cur = await conn.execute(
            "select count(*) as n, min(vt) > now() as delayed, "
            "max((message->>'llm_attempt')::int) as attempt from pgmq.q_review_jobs"
        )
        row["queue"] = await cur.fetchone()
        return row


@needs_db
async def test_rate_limited_run_goes_pending_then_fills_in(pool: Any) -> None:
    cid = await submit(pool)
    router, provider = make_router(RateLimited("groq", "429"))
    assert await work_one(pool, router) == "done"

    r = await run_of(pool, cid)
    assert r["status"] == "running" and r["llm_pending"] is True and r["degraded"] is False
    assert r["llm_attempts"] == 1 and r["error_code"] == "llm_rate_limited"
    assert r["llm_next_at"] is not None
    assert r["n"] == 4 and r["n_llm"] == 0  # the four deterministic findings, right away
    assert r["content_state"] == "ai_check"  # not routed on partial results
    assert r["queue"] == {"n": 1, "delayed": True, "attempt": 1}  # the retry is queued, delayed
    assert "pending_since" in r["timings"]

    # Nothing is visible yet: the retry waits for its delay.
    assert await work_one(pool, router) is None

    router2, provider2 = make_router(LLM_OK)
    assert await work_one(pool, router2, make_visible=True) == "done"
    r = await run_of(pool, cid)
    assert r["status"] == "done" and r["llm_pending"] is False and r["degraded"] is False
    assert r["n"] == 5 and r["n_llm"] == 1  # merged: 4 deterministic + 1 LLM, through the gate
    assert r["llm_next_at"] is None and r["llm_attempts"] == 1
    assert r["timings"]["pending_ms"] >= 0
    assert r["content_state"] == "needs_revision"  # routed once, on the complete result
    assert r["queue"]["n"] == 0
    assert provider.calls == 1 and provider2.calls == 1  # one LLM pass per attempt


@needs_db
async def test_findings_are_replaced_not_duplicated_on_redelivery(pool: Any) -> None:
    cid = await submit(pool)
    router, _ = make_router(RateLimited("groq", "429"))
    await work_one(pool, router)
    # The original (attempt 0) message is redelivered after the run went pending: it is stale.
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select r.id::text as run_id, r.version_id::text as version_id "
            "from public.review_runs r join public.versions v on v.id = r.version_id "
            "where v.content_id = %s",
            (cid,),
        )
        ids = await cur.fetchone()
        await conn.execute(
            "select pgmq.send(%s, %s::jsonb)",
            (QUEUE, __import__("json").dumps({**ids, "org_id": ORG})),
        )
    stale_router, stale = make_router(LLM_OK)
    assert await work_one(pool, stale_router) == "done"
    assert stale.calls == 0  # skipped before any LLM call
    r = await run_of(pool, cid)
    assert r["llm_pending"] is True and r["n"] == 4


@needs_db
async def test_out_of_attempts_finishes_degraded(
    pool: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config, "LLM_PENDING_RETRY_DELAYS_S", (60,))
    cid = await submit(pool)
    router, _ = make_router(RateLimited("groq", "429"), RateLimited("groq", "429"))
    await work_one(pool, router)
    assert (await run_of(pool, cid))["llm_pending"] is True
    await work_one(pool, router, make_visible=True)
    r = await run_of(pool, cid)
    assert r["status"] == "done" and r["degraded"] is True and r["llm_pending"] is False
    assert r["llm_attempts"] == 2 and r["n"] == 4
    assert r["content_state"] == "needs_revision" and r["queue"]["n"] == 0


@needs_db
async def test_permanent_failure_degrades_at_once(pool: Any) -> None:
    cid = await submit(pool)
    router, _ = make_router(ModelUnavailable("groq", "set GROQ_MODEL_TEXT"))
    await work_one(pool, router)
    r = await run_of(pool, cid)
    assert r["status"] == "done" and r["degraded"] is True and r["llm_pending"] is False
    assert r["llm_attempts"] == 0 and r["queue"]["n"] == 0


def test_web_attempt_count_matches_worker_config() -> None:
    from pathlib import Path

    limits = Path(__file__).resolve().parents[2] / "web" / "lib" / "limits.ts"
    expected = f"LLM_MAX_ATTEMPTS = {1 + len(config.LLM_PENDING_RETRY_DELAYS_S)};"
    assert expected in limits.read_text(encoding="utf-8")
