"""Job `review_version` (review_jobs): run the pipeline on one version and route the content.

P06: stages 1–4 (ingest, protect, deterministic filters, retrieve). P07 adds the LLM pass + gate.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any
from uuid import UUID

import numpy as np
import numpy.typing as npt
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from brandlens_worker import config, db
from brandlens_worker.embeddings import to_pgvector
from brandlens_worker.jobs.common import get_embedder, get_storage
from brandlens_worker.pipeline.ingest import IngestError
from brandlens_worker.pipeline.routing import RoutingFinding, has_open_blockers, route
from brandlens_worker.pipeline.run import StagesResult, VersionInput, run_stages_1_to_4
from brandlens_worker.pipeline.types import Doc, Fact, Finding, GlossaryTerm, Rule, Vault
from brandlens_worker.queue import JobContext, JobError

log = logging.getLogger(__name__)


class ReviewPayload(BaseModel):
    run_id: UUID
    version_id: UUID
    org_id: UUID


async def load_vault(conn: Any, org_id: UUID, campaign_id: str, campaign_name: str) -> Vault:
    cur = await conn.execute(
        "select id::text, code, dimension::text as dimension, title, body, "
        "severity::text as severity, "
        "examples from public.rule_cards where org_id = %s and status = 'approved'",
        (org_id,),
    )
    rules = [Rule(**r) for r in await cur.fetchall()]
    cur = await conn.execute(
        "select f.id::text, f.code, f.kind::text as kind, f.statement, f.value, "
        "f.campaign_id::text as campaign_id, c.name as campaign_name, f.required_disclaimer, "
        "f.valid_until from public.facts f left join public.campaigns c on c.id = f.campaign_id "
        "where f.org_id = %s",
        (org_id,),
    )
    facts = [Fact(**r) for r in await cur.fetchall()]
    cur = await conn.execute(
        "select code, preferred, variants, banned, case_sensitive from public.glossary_terms "
        "where org_id = %s",
        (org_id,),
    )
    glossary = [GlossaryTerm(**r) for r in await cur.fetchall()]
    cur = await conn.execute("select now() as now")
    now = (await cur.fetchone())["now"]
    return Vault(campaign_id, campaign_name, rules, facts, glossary, now)


def to_row(f: Finding, doc: Doc, codes_by_id: dict[str, str]) -> dict[str, Any]:
    """Map a pipeline finding to a `findings` row: spans and quote in the ORIGINAL text."""
    start, end = doc.to_original(f.start, f.end)
    primary = {codes_by_id.get(x) for x in (f.rule_id, f.fact_id) if x} | {
        f.wcag_ref and f"WCAG {f.wcag_ref}"
    }
    extra = [c for c in f.codes if c not in primary]
    explanation = f.explanation + (f" Also cites: {', '.join(extra)}." if extra else "")
    return {
        "dimension": f.dimension,
        "rule_id": f.rule_id,
        "fact_id": f.fact_id,
        "wcag_ref": f.wcag_ref,
        "quote": doc.original[start:end],
        "span": {"start": start, "end": end},
        "severity": f.severity,
        "confidence": f.confidence,
        "source": f.source,
        "explanation": explanation,
        "rewrite": f.rewrite,
    }


async def review_version(ctx: JobContext) -> None:
    p = ReviewPayload.model_validate(ctx.message.payload)
    started = time.perf_counter()

    async with ctx.pool.connection() as conn:
        await db.mark_run_running(conn, p.run_id)
        cur = await conn.execute(
            "select v.body, v.format::text as format, v.storage_path, v.intent, "
            "c.id::text as content_id, "
            "c.campaign_id::text as campaign_id, cp.name as campaign_name, c.org_id "
            "from public.versions v join public.contents c on c.id = v.content_id "
            "join public.campaigns cp on cp.id = c.campaign_id "
            "where v.id = %s and c.org_id = %s",
            (p.version_id, p.org_id),
        )
        row = await cur.fetchone()
        if row is None:
            raise JobError("version_not_found")
        vault = await load_vault(conn, p.org_id, row["campaign_id"], row["campaign_name"])

    data = None
    if row["format"] == "docx" and row["storage_path"]:
        data = await get_storage(ctx).download("drafts", row["storage_path"])

    embedder = get_embedder(ctx)

    async def embed(texts: list[str]) -> npt.NDArray[np.float32]:
        result: npt.NDArray[np.float32] = await asyncio.to_thread(embedder.embed, texts)
        return result

    async def match_vault(vec: npt.NDArray[np.float32]) -> list[dict[str, Any]]:
        async with ctx.pool.connection() as conn:
            cur = await conn.execute(
                "select id::text, code, kind, dimension::text as dimension, similarity "
                "from public.match_vault(%s, %s, %s::extensions.vector, %s)",
                (p.org_id, row["campaign_id"], to_pgvector(vec), config.TOPK),
            )
            return list(await cur.fetchall())

    try:
        result = await run_stages_1_to_4(
            VersionInput(format=row["format"], body=row["body"], data=data, intent=row["intent"]),
            vault,
            embed=embed,
            match_vault=match_vault,
            topk=config.TOPK,
        )
    except IngestError as exc:
        raise JobError(exc.code) from exc
    except NotImplementedError as exc:
        raise JobError("unsupported_format") from exc

    await persist(ctx, p, row["content_id"], vault, result, started)


async def persist(
    ctx: JobContext,
    p: ReviewPayload,
    content_id: str,
    vault: Vault,
    result: StagesResult,
    started: float,
) -> None:
    codes_by_id = {r.id: r.code for r in vault.rules} | {f.id: f.code for f in vault.facts}
    rows = [to_row(f, result.doc, codes_by_id) for f in result.findings]
    timings = {**result.timings, "total": round((time.perf_counter() - started) * 1000)}

    async with ctx.pool.connection() as conn, conn.transaction():
        # Idempotent per run: a retried job replaces its own findings.
        await conn.execute("delete from public.findings where run_id = %s", (p.run_id,))
        for r in rows:
            await conn.execute(
                "insert into public.findings "
                "(org_id, version_id, run_id, dimension, rule_id, fact_id, "
                "wcag_ref, quote, span, severity, confidence, source, explanation, rewrite) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    p.org_id, p.version_id, p.run_id, r["dimension"], r["rule_id"], r["fact_id"],
                    r["wcag_ref"], r["quote"], Jsonb(r["span"]), r["severity"], r["confidence"],
                    r["source"], r["explanation"], r["rewrite"],
                ),
            )  # fmt: skip
        await conn.execute(
            "update public.review_runs set status = 'done', finished_at = now(), retrieved = %s, "
            "timings = timings || %s where id = %s",
            (Jsonb(result.retrieved), Jsonb(timings), p.run_id),
        )
        routing = [RoutingFinding(r["dimension"], r["severity"]) for r in rows]
        if has_open_blockers(routing):
            await conn.execute(
                "select public.transition_content_system(%s, 'needs_revision')", (content_id,)
            )
            outcome, risk = "needs_revision", None
        else:
            to, risk = route(routing)
            await conn.execute(
                "select public.transition_content_system(%s, 'in_review', null, %s, %s)",
                (content_id, to, risk),
            )
            outcome = f"in_review:{to}"

    log.info(
        "review done",
        extra={
            "run_id": str(p.run_id),
            "findings": len(rows),
            "outcome": outcome,
            "risk": risk,
            "timings": timings,
        },
    )
