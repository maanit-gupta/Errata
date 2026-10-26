"""Postgres access for the worker: an async psycopg pool plus the queries jobs need.

In cloud, DATABASE_URL must be the Supabase *session* pooler (port 5432): pgmq long-polling holds a
connection, which the transaction pooler (6543) doesn't support.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

log = logging.getLogger(__name__)

Conn = AsyncConnection[dict[str, Any]]


def create_pool(dsn: str, *, min_size: int = 1, max_size: int = 5) -> AsyncConnectionPool[Conn]:
    """Create (but don't open) the pool. Open it with `await pool.open()` in the app lifespan."""
    return AsyncConnectionPool(
        dsn,
        min_size=min_size,
        max_size=max_size,
        open=False,
        kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": None},
        name="brandlens-worker",
    )


async def get_run_status(conn: Conn, run_id: UUID | str) -> str | None:
    cur = await conn.execute(
        "select status::text as status from public.review_runs where id = %s", (run_id,)
    )
    row = await cur.fetchone()
    return None if row is None else str(row["status"])


async def mark_run_running(conn: Conn, run_id: UUID | str) -> None:
    await conn.execute(
        "update public.review_runs "
        "set status = 'running', started_at = coalesce(started_at, now()) where id = %s",
        (run_id,),
    )


async def fail_run(conn: Conn, run_id: UUID | str, error_code: str) -> None:
    """Mark a run failed and hand its content back to the creator (ai_check → draft)."""
    async with conn.transaction():
        cur = await conn.execute(
            "update public.review_runs set status = 'failed', error_code = %s, finished_at = now() "
            "where id = %s and status <> 'done' returning version_id",
            (error_code, run_id),
        )
        row = await cur.fetchone()
        if row is None:
            return
        cur = await conn.execute(
            "select c.id, c.state::text as state from public.contents c "
            "join public.versions v on v.content_id = c.id where v.id = %s",
            (row["version_id"],),
        )
        content = await cur.fetchone()
        if content and content["state"] == "ai_check":
            await conn.execute(
                "select public.transition_content_system(%s, 'draft', %s)",
                (content["id"], f"Review failed ({error_code}); please resubmit."),
            )


async def update_run_timings(conn: Conn, run_id: UUID | str, timings: dict[str, Any]) -> None:
    await conn.execute(
        "update public.review_runs set timings = timings || %s where id = %s",
        (Jsonb(timings), run_id),
    )
