"""Job `embed_vault` (vault_jobs): embed approved rule cards and facts that are new or changed."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from pydantic import BaseModel

from brandlens_worker.embeddings import to_pgvector
from brandlens_worker.jobs.common import get_embedder
from brandlens_worker.queue import JobContext
from brandlens_worker.vault import plan_embeddings

log = logging.getLogger(__name__)

BATCH = 32


class EmbedVaultPayload(BaseModel):
    org_id: UUID


async def embed_vault(ctx: JobContext) -> None:
    p = EmbedVaultPayload.model_validate(ctx.message.payload)
    async with ctx.pool.connection() as conn:
        cur = await conn.execute(
            "select id, title, summary, body, examples, embedding_source_hash, "
            "embedding is not null as has_embedding "
            "from public.rule_cards where org_id = %s and status = 'approved'",
            (p.org_id,),
        )
        rules = await cur.fetchall()
        cur = await conn.execute(
            "select id, statement, value, embedding_source_hash, "
            "embedding is not null as has_embedding "
            "from public.facts where org_id = %s",
            (p.org_id,),
        )
        facts = await cur.fetchall()

    tasks = plan_embeddings(rules, facts)
    if not tasks:
        log.info("vault embeddings up to date", extra={"org_id": str(p.org_id)})
        return

    embedder = get_embedder(ctx)
    for start in range(0, len(tasks), BATCH):
        batch = tasks[start : start + BATCH]
        vectors = await asyncio.to_thread(embedder.embed, [t.text for t in batch])
        async with ctx.pool.connection() as conn, conn.transaction():
            for task, vec in zip(batch, vectors, strict=True):
                table = "public.rule_cards" if task.table == "rule_cards" else "public.facts"
                await conn.execute(
                    f"update {table} "
                    "set embedding = %s::extensions.vector, embedding_source_hash = %s "
                    "where id = %s",
                    (to_pgvector(vec), task.hash, task.id),
                )
    log.info(
        "vault embedded",
        extra={
            "org_id": str(p.org_id),
            "rules": sum(t.table == "rule_cards" for t in tasks),
            "facts": sum(t.table == "facts" for t in tasks),
        },
    )
