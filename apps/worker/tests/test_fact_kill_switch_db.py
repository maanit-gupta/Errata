"""Hero 2 against Postgres (TEST_DATABASE_URL, like test_llm_pending.py): a real review writes
content_fact_dependencies; the SQL hash matches the Python mirror; the worker's sweep loop moves
approved content whose fact expired without any UPDATE firing."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from brandlens_worker.main import sweep_facts
from brandlens_worker.manifest import content_sha256
from tests.test_llm_pending import (  # noqa: F401  (pool is a fixture)
    LLM_OK,
    make_router,
    needs_db,
    pool,
    submit,
    work_one,
)


@needs_db
async def test_review_writes_fact_dependencies(pool: Any) -> None:  # noqa: F811
    cid = await submit(pool)  # HERO: wrong fee, wrong date, a returns claim
    router, _ = make_router(LLM_OK)
    assert await work_one(pool, router) == "done"
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select f.code from public.content_fact_dependencies d "
            "join public.facts f on f.id = d.fact_id where d.content_id = %s order by f.code",
            (cid,),
        )
        codes = [r["code"] for r in await cur.fetchall()]
    assert codes == ["E-19", "F-048", "F-112"]


@needs_db
@pytest.mark.parametrize(
    "body",
    ["plain", "  lead and trail  ", "tabs\tand\nnewlines\r\n", "a  nbsp", "", "é ü 中文  ok"],
)
async def test_sql_hash_matches_python(pool: Any, body: str) -> None:  # noqa: F811
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select encode(extensions.digest(private.normalise_body(%s), 'sha256'), 'hex') as h",
            (body,),
        )
        assert (await cur.fetchone())["h"] == content_sha256(body)


@needs_db
async def test_worker_sweep_catches_a_silent_expiry(pool: Any) -> None:  # noqa: F811
    cid = await submit(pool)
    router, _ = make_router(LLM_OK)
    await work_one(pool, router)
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select valid_until from public.facts where code = 'F-112' "
            "and org_id = '00000000-0000-4000-8000-0000000000a1'"
        )
        original = (await cur.fetchone())["valid_until"]
        # Test setup: approve the content directly (the real path needs a reviewer).
        async with conn.transaction():
            await conn.execute("select private.allow_workflow_write(true)")
            await conn.execute(
                "update public.contents set state = 'approved' where id = %s", (cid,)
            )
        # The date passes with no UPDATE trigger (disabled inside one transaction).
        async with conn.transaction():
            await conn.execute("alter table public.facts disable trigger facts_kill_switch_update")
            await conn.execute(
                "update public.facts set valid_until = now() - interval '1 minute' "
                "where code = 'F-112' and org_id = '00000000-0000-4000-8000-0000000000a1'"
            )
            await conn.execute("alter table public.facts enable trigger facts_kill_switch_update")
    try:
        stop = asyncio.Event()
        task = asyncio.create_task(sweep_facts(pool, stop))
        await asyncio.sleep(0.5)
        stop.set()
        await asyncio.wait_for(task, 5)
        async with pool.connection() as conn:
            cur = await conn.execute(
                "select state::text as s from public.contents where id = %s", (cid,)
            )
            assert (await cur.fetchone())["s"] == "needs_revision"
            cur = await conn.execute(
                "select count(*) as n from public.audit_events where event->>'type' = "
                "'fact_kill_switch' and event->>'content_id' = %s and event->>'cause' = 'expired'",
                (cid,),
            )
            assert (await cur.fetchone())["n"] == 1
    finally:
        async with pool.connection() as conn:
            await conn.execute(
                "update public.facts set valid_until = %s where code = 'F-112' "
                "and org_id = '00000000-0000-4000-8000-0000000000a1'",
                (original,),
            )
