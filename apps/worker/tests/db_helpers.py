"""Helpers for the DB-gated tests (TEST_DATABASE_URL): they swap in fixed embeddings so retrieval is
deterministic, and must put the real ones back so a local dev stack keeps working afterwards."""

from __future__ import annotations

from typing import Any

TABLES = ("rule_cards", "facts")


async def snapshot_embeddings(conn: Any, org_id: str) -> dict[str, list[tuple[str, str | None]]]:
    snap: dict[str, list[tuple[str, str | None]]] = {}
    for table in TABLES:
        cur = await conn.execute(
            f"select id::text as id, embedding::text as e from public.{table} where org_id = %s",
            (org_id,),
        )
        snap[table] = [(r["id"], r["e"]) for r in await cur.fetchall()]
    return snap


async def restore_embeddings(conn: Any, snap: dict[str, list[tuple[str, str | None]]]) -> None:
    for table, rows in snap.items():
        for rid, emb in rows:
            await conn.execute(
                f"update public.{table} set embedding = %s::extensions.vector where id = %s",
                (emb, rid),
            )
