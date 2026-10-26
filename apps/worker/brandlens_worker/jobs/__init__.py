"""Job registry. Jobs do I/O; pipeline stages stay pure (CLAUDE.md coding conventions)."""

from __future__ import annotations

import logging

from brandlens_worker.queue import JobContext, Registry

log = logging.getLogger(__name__)


async def noop(ctx: JobContext) -> None:
    """Test job: proves the consumer reads, dispatches and deletes."""
    log.info("noop job consumed", extra={"queue": ctx.queue, "msg_id": ctx.message.msg_id})


def build_registry() -> Registry:
    from brandlens_worker.jobs.embed_vault import embed_vault
    from brandlens_worker.jobs.ingest_guide import ingest_guide

    registry = Registry()
    registry.add("noop", noop)
    registry.add("ingest_guide", ingest_guide)
    registry.add("embed_vault", embed_vault)
    return registry
