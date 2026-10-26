"""Job `ingest_guide` (vault_jobs): brand guide → draft rule cards (SPEC §12)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb
from pydantic import BaseModel

from brandlens_worker.guides import (
    Chunk,
    RuleCardDraft,
    RuleCardDrafts,
    assign_codes,
    chunk_sections,
    clamp_pages,
    dedupe,
    parse_docx,
    parse_markdown,
    parse_pdf,
)
from brandlens_worker.jobs.common import get_embedder, get_router, get_storage, get_tracer
from brandlens_worker.llm.base import DegradedError
from brandlens_worker.prompts import load_prompt
from brandlens_worker.queue import JobContext, JobError

log = logging.getLogger(__name__)


class IngestGuidePayload(BaseModel):
    org_id: UUID
    guide_id: UUID


async def extract_drafts(
    chunks: list[Chunk], router: Any, tracer: Any, *, guide_id: str
) -> list[RuleCardDraft]:
    """One structured LLM call per chunk. The guide text is delimited as data."""
    system, version = load_prompt("rule_extract")
    drafts: list[RuleCardDraft] = []
    for i, chunk in enumerate(chunks):
        user = f"<guide>\n{chunk.text}\n</guide>"
        out, meta = await router.generate(system, user, RuleCardDrafts, prompt_version=version)
        cards = clamp_pages(out.cards, chunk)
        drafts.extend(cards)
        tracer.generation(
            "rule_extract",
            prompt_version=version,
            model=meta.model,
            input_meta={
                "guide_id": guide_id,
                "chunk": i,
                "chars": len(chunk.text),
                "pages": chunk.pages,
            },
            output={"cards": len(cards), "codes": [c.code_suggestion for c in cards]},
            usage={"input": meta.input_tokens or 0, "output": meta.output_tokens or 0},
            latency_ms=meta.latency_ms,
        )
    return drafts


async def _load_source(ctx: JobContext, guide: dict[str, Any]) -> list[Any]:
    kind = guide["source_kind"]
    if kind == "url":
        import trafilatura

        html = await asyncio.to_thread(trafilatura.fetch_url, guide["source_url"])
        if not html:
            raise JobError("fetch_failed")
        md = trafilatura.extract(html, output_format="markdown", include_formatting=True) or ""
        return parse_markdown(md)
    data = await get_storage(ctx).download("guides", guide["storage_path"])
    return parse_pdf(data) if kind == "pdf" else parse_docx(data)


async def ingest_guide(ctx: JobContext) -> None:
    p = IngestGuidePayload.model_validate(ctx.message.payload)
    async with ctx.pool.connection() as conn:
        cur = await conn.execute(
            "select id, org_id, title, source_kind::text as source_kind, storage_path, source_url "
            "from public.brand_guides where id = %s and org_id = %s",
            (p.guide_id, p.org_id),
        )
        guide = await cur.fetchone()
        if guide is None:
            raise JobError("guide_not_found")
        await conn.execute(
            "update public.brand_guides set status = 'parsing', error = null where id = %s",
            (p.guide_id,),
        )

    tracer = get_tracer(ctx)
    try:
        with tracer.trace_run(str(p.guide_id), name="ingest_guide", org_id=str(p.org_id)):
            sections = await _load_source(ctx, guide)
            chunks = chunk_sections(sections)
            if not chunks:
                raise JobError("empty_guide")
            drafts = await extract_drafts(chunks, get_router(ctx), tracer, guide_id=str(p.guide_id))
            embedder = get_embedder(ctx)
            drafts = await asyncio.to_thread(dedupe, drafts, embedder.embed)
        await _insert_drafts(ctx, p, drafts)
    except Exception as exc:
        code = (
            exc.code
            if isinstance(exc, JobError)
            else (
                "llm_unavailable"
                if isinstance(exc, DegradedError)
                else f"crash:{type(exc).__name__}"
            )
        )
        async with ctx.pool.connection() as conn:
            await conn.execute(
                "update public.brand_guides set status = 'failed', error = %s where id = %s",
                (code, p.guide_id),
            )
        raise JobError(code) from exc
    finally:
        tracer.flush()


async def _insert_drafts(
    ctx: JobContext, p: IngestGuidePayload, drafts: list[RuleCardDraft]
) -> None:
    async with ctx.pool.connection() as conn, conn.transaction():
        cur = await conn.execute(
            "select code, max(version) as v from public.rule_cards where org_id = %s group by code",
            (p.org_id,),
        )
        existing = {r["code"]: int(r["v"]) for r in await cur.fetchall()}
        coded = assign_codes(drafts, existing)
        for c in coded:
            d = c.draft
            await conn.execute(
                "insert into public.rule_cards "
                "(org_id, guide_id, code, dimension, title, summary, body, "
                "examples, severity, status, version, source_page) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s, %s)",
                (
                    p.org_id,
                    p.guide_id,
                    c.code,
                    d.dimension,
                    d.title,
                    d.summary,
                    d.body,
                    Jsonb([{**e.model_dump(), "source": "guide"} for e in d.examples]),
                    d.severity,
                    c.version,
                    d.source_page,
                ),
            )
        await conn.execute(
            "update public.brand_guides set status = 'drafted', error = null where id = %s",
            (p.guide_id,),
        )
    log.info(
        "guide drafted",
        extra={"guide_id": str(p.guide_id), "cards": len(coded), "codes": [c.code for c in coded]},
    )
