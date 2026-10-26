"""Job `review_version` (review_jobs): run the pipeline on one version and route the content.

P06: stages 1–4 (ingest, protect, deterministic filters, retrieve). P07 adds the LLM pass + gate.
P11: images (OCR, logo, contrast, palette, alt text; one vision call).
P12: PDFs (text layer with page boxes, hidden text, page renders to `renders/`, one LLM call per
page chunk).
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
from brandlens_worker.jobs.common import get_embedder, get_router, get_storage, get_tracer
from brandlens_worker.llm.base import DegradedError
from brandlens_worker.notify import notify_needs_review
from brandlens_worker.pipeline.image import VisualKit
from brandlens_worker.pipeline.ingest import IngestError
from brandlens_worker.pipeline.routing import RoutingFinding, has_open_blockers, route
from brandlens_worker.pipeline.run import (
    LLMStageResult,
    StagesResult,
    VersionInput,
    run_stages_1_to_4,
    run_stages_5_6,
)
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


async def load_kit(conn: Any, org_id: UUID, storage: Any, cache: dict[str, Any]) -> VisualKit:
    """The org's logo templates and palette (SPEC §3 `assets`). Logo files are cached per process
    by storage path; a logo that can't be downloaded or decoded is skipped, never fatal."""
    from brandlens_worker.vision.colour import PaletteColour
    from brandlens_worker.vision.logo import load_template

    cur = await conn.execute(
        "select kind::text as kind, name, storage_path, spec from public.assets "
        "where org_id = %s and kind in ('logo', 'palette') order by created_at, name",
        (org_id,),
    )
    logos, palette = [], []
    max_de, min_width, ratio = (
        float(config.DELTA_E_MAX_DEFAULT),
        config.LOGO_MIN_WIDTH_DEFAULT,
        config.CLEAR_SPACE_RATIO_DEFAULT,
    )
    for a in await cur.fetchall():
        spec = a["spec"] or {}
        if a["kind"] == "palette":
            palette += [
                PaletteColour(str(c.get("name", c["hex"])), str(c["hex"]))
                for c in spec.get("colours", [])
                if isinstance(c, dict) and c.get("hex")
            ]
            max_de = float(spec.get("max_delta_e", max_de))
            continue
        path = a["storage_path"]
        if not path:
            continue
        try:
            if path not in cache:
                cache[path] = load_template(a["name"], await storage.download("assets", path))
            logos.append(cache[path])
            min_width = int(spec.get("min_width_px", min_width))
            ratio = float(spec.get("min_clear_space_ratio", ratio))
        except Exception as exc:
            log.warning("logo asset unavailable", extra={"path": path, "error": type(exc).__name__})
    return VisualKit(logos, palette, max_de, min_width, ratio)


def to_row(f: Finding, doc: Doc, codes_by_id: dict[str, str]) -> dict[str, Any]:
    """Map a pipeline finding to a `findings` row: spans and quote in the ORIGINAL text.

    Image findings: `{"x0","y0","x1","y1"}` pixel boxes (SPEC §3); text read from an image keeps
    its text offsets and adds the box; alt-text findings index the alt text.
    """
    span: dict[str, Any]
    if f.target == "image":
        assert f.bbox is not None
        x0, y0, x1, y1 = f.bbox
        span, quote = {"x0": x0, "y0": y0, "x1": x1, "y1": y1}, f.quote or ""
        if f.page:
            span["page"] = f.page
    elif f.target == "alt_text":
        span, quote = {"target": "alt_text", "start": f.start, "end": f.end}, f.quote or ""
    else:
        start, end = doc.to_original(f.start, f.end)
        span, quote = {"start": start, "end": end}, f.quote or doc.original[start:end]
        box = f.bbox or doc.bbox_for(f.start, f.end)
        if box:
            span |= {"x0": box[0], "y0": box[1], "x1": box[2], "y1": box[3]}
        page = doc.page_for(f.start, f.end)
        if page:
            span["page"] = page
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
        "quote": quote,
        "span": span,
        "severity": f.severity,
        "confidence": f.confidence,
        "source": f.source,
        "explanation": explanation,
        "rewrite": f.rewrite,
    }


CARRY_STATUSES = ("routed", "dismissed")


def carry_over(rows: list[dict[str, Any]], prior: list[dict[str, Any]]) -> None:
    """Resubmits keep earlier decisions: a new finding identical to one already routed or dismissed
    (same dimension, citations and quote) inherits that resolution. `prior` is newest first."""
    seen: dict[tuple[Any, ...], dict[str, Any]] = {}
    for item in prior:
        seen.setdefault((item["dimension"], item["rule_id"], item["fact_id"], item["quote"]), item)
    for r in rows:
        match = seen.get((r["dimension"], r["rule_id"], r["fact_id"], r["quote"]))
        if match:
            r["status"] = match["status"]
            r["dismiss_reason"] = match["dismiss_reason"]
            r["dismiss_note"] = match["dismiss_note"]
            r["resolved_by"] = match["resolved_by"]


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
    if row["format"] in ("docx", "image", "pdf") and row["storage_path"]:
        data = await get_storage(ctx).download("drafts", row["storage_path"])
    kit = None
    if row["format"] in ("image", "pdf"):
        async with ctx.pool.connection() as conn:
            kit = await load_kit(
                conn, p.org_id, get_storage(ctx), ctx.services.setdefault("logo_cache", {})
            )
    settings = ctx.services.get("settings")
    ocr_engine = getattr(settings, "ocr_engine", "tesseract")

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

    tracer = get_tracer(ctx)
    with tracer.trace_run(
        str(p.run_id), org_id=str(p.org_id), version_id=str(p.version_id)
    ) as root:
        try:
            with tracer.trace_run(str(p.run_id), name="stages_1_4"):
                result = await run_stages_1_to_4(
                    VersionInput(
                        format=row["format"],
                        body=row["body"],
                        data=data,
                        intent=row["intent"] or {},
                        kit=kit,
                        ocr_engine=ocr_engine,
                    ),
                    vault,
                    embed=embed,
                    match_vault=match_vault,
                    topk=config.TOPK,
                )
        except IngestError as exc:
            raise JobError(exc.code) from exc
        except NotImplementedError as exc:
            raise JobError("unsupported_format") from exc

        llm: LLMStageResult | None = None
        try:
            with tracer.trace_run(str(p.run_id), name="stages_5_6"):
                llm = await run_stages_5_6(
                    result,
                    vault,
                    row["intent"] or {},
                    router=get_router(ctx),
                    embed_sync=embedder.embed,
                )
            for g in llm.generations:
                meta = g["meta"]
                image_meta = (
                    {
                        "ocr_engine": result.image.ocr_engine,
                        "logo": result.image.logo.method if result.image.logo else None,
                        "style_check": result.image.warmth.cool,
                    }
                    if result.image
                    else {}
                )
                tracer.generation(
                    g["name"],
                    prompt_version=llm.prompt_version,
                    model=meta.model,
                    input_meta={
                        "run_id": str(p.run_id),
                        "retrieved": len(result.retrieved),
                        "already_found": len(result.findings),
                        "redactions": len(result.redacted.redactions),
                        "words": result.doc.word_count,
                        **image_meta,
                    },
                    output={"findings": g["findings"]},
                    usage={"input": meta.input_tokens or 0, "output": meta.output_tokens or 0},
                    latency_ms=meta.latency_ms,
                    metadata={"provider": meta.provider, "cache_hit": meta.cache_hit},
                )
        except DegradedError:
            log.warning(
                "llm unavailable; deterministic findings only", extra={"run_id": str(p.run_id)}
            )
        root.update(
            metadata={
                "deterministic": len(result.findings),
                "llm_kept": len(llm.findings) if llm else 0,
                "gate_drops": llm.drops if llm else {},
                "rewrite_failures": llm.rewrite_failures if llm else {},
                "degraded": llm is None,
            }
        )
        trace_id = tracer.current_trace_id()
    tracer.flush()

    pages = await upload_renders(ctx, p, row["content_id"], result)
    await persist(
        ctx, p, row["content_id"], vault, result, started, llm=llm, trace_id=trace_id, pages=pages
    )


async def upload_renders(
    ctx: JobContext, p: ReviewPayload, content_id: str, result: StagesResult
) -> list[dict[str, Any]]:
    """PDF page thumbnails → `renders/{org}/{content}/{version}/page-{n}.png` (SPEC §3). The
    manifest lands in `review_runs.pages`; finding boxes are in these images' pixel space."""
    if result.pdf is None:
        return []
    storage = get_storage(ctx)
    paths = [f"{p.org_id}/{content_id}/{p.version_id}/page-{pg.n}.png" for pg in result.pdf.pages]
    try:
        for page, path in zip(result.pdf.pages, paths, strict=True):
            await storage.upload("renders", path, page.png, "image/png")
    except Exception as exc:
        raise JobError("render_upload_failed") from exc
    return result.pdf.manifest(paths)


async def persist(
    ctx: JobContext,
    p: ReviewPayload,
    content_id: str,
    vault: Vault,
    result: StagesResult,
    started: float,
    *,
    llm: LLMStageResult | None,
    trace_id: str | None,
    pages: list[dict[str, Any]] | None = None,
) -> None:
    codes_by_id = {r.id: r.code for r in vault.rules} | {f.id: f.code for f in vault.facts}
    rows = [to_row(f, result.doc, codes_by_id) for f in result.findings]
    if llm:
        for f in llm.findings:
            rows.append(
                {
                    **to_row(f, result.doc, codes_by_id),
                    "model_version": llm.model_version,
                    "prompt_version": llm.prompt_version,
                }
            )
    timings: dict[str, Any] = {**result.timings, **(llm.timings if llm else {})}
    timings["total"] = round((time.perf_counter() - started) * 1000)
    timings["gate"] = llm.drops if llm else {}
    timings["rewrite_failures"] = llm.rewrite_failures if llm else {}
    if trace_id:
        timings["trace_id"] = trace_id
    if result.pdf is not None:
        timings["pdf"] = {
            "pages": len(result.pdf.pages),
            "hidden": len(result.pdf.hidden),
            "images": sum(pg.images for pg in result.pdf.pages),
            "cool_images": sum(pg.cool_images for pg in result.pdf.pages),
        }

    async with ctx.pool.connection() as conn, conn.transaction():
        cur = await conn.execute(
            "select f.dimension::text as dimension, f.rule_id::text as rule_id, "
            "f.fact_id::text as fact_id, f.quote, f.status::text as status, "
            "f.dismiss_reason::text as dismiss_reason, f.dismiss_note, f.resolved_by "
            "from public.findings f join public.versions v on v.id = f.version_id "
            "where v.content_id = %s and f.version_id <> %s "
            "and f.status in ('routed', 'dismissed') "
            "order by f.created_at desc",
            (content_id, p.version_id),
        )
        carry_over(rows, list(await cur.fetchall()))
        # Idempotent per run: a retried job replaces its own findings.
        await conn.execute("delete from public.findings where run_id = %s", (p.run_id,))
        for r in rows:
            await conn.execute(
                "insert into public.findings "
                "(org_id, version_id, run_id, dimension, rule_id, fact_id, "
                "wcag_ref, quote, span, severity, confidence, source, explanation, rewrite, "
                "model_version, prompt_version, status, dismiss_reason, dismiss_note, resolved_by, "
                "resolved_at) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
                "%s, %s, %s, %s, case when %s <> 'open' then now() end)",
                (
                    p.org_id, p.version_id, p.run_id, r["dimension"], r["rule_id"], r["fact_id"],
                    r["wcag_ref"], r["quote"], Jsonb(r["span"]), r["severity"], r["confidence"],
                    r["source"], r["explanation"], r["rewrite"],
                    r.get("model_version"), r.get("prompt_version"),
                    r.get("status", "open"), r.get("dismiss_reason"), r.get("dismiss_note"),
                    r.get("resolved_by"), r.get("status", "open"),
                ),
            )  # fmt: skip
        await conn.execute(
            "update public.review_runs set status = 'done', finished_at = now(), retrieved = %s, "
            "timings = timings || %s, degraded = %s, error_code = %s, provider = %s, "
            "model_version = %s, prompt_version = %s, pages = %s where id = %s",
            (
                Jsonb(result.retrieved),
                Jsonb(timings),
                llm is None,
                None if llm else "llm_unavailable",
                llm.provider if llm else None,
                llm.model_version if llm else None,
                llm.prompt_version if llm else None,
                Jsonb(pages or []),
                p.run_id,
            ),
        )
        routing = [
            RoutingFinding(r["dimension"], r["severity"], r.get("status", "open")) for r in rows
        ]
        notify_title = ""
        if has_open_blockers(routing):
            await conn.execute(
                "select public.transition_content_system(%s::uuid, 'needs_revision')", (content_id,)
            )
            outcome, risk = "needs_revision", None
        else:
            to, risk = route(routing)
            await conn.execute(
                "select public.transition_content_system("
                "%s::uuid, 'in_review', null, %s::text, %s::real)",
                (content_id, to, risk),
            )
            outcome = f"in_review:{to}"
            cur = await conn.execute(
                "select title from public.contents where id = %s", (content_id,)
            )
            title_row = await cur.fetchone()
            notify_title = title_row["title"] if title_row else "Content"

    if outcome.startswith("in_review:") and "settings" in ctx.services:
        notify_needs_review(
            ctx.services["settings"],
            title=notify_title,
            content_id=content_id,
            route_to=outcome.split(":", 1)[1],
            risk=risk,
        )

    log.info(
        "review done",
        extra={
            "run_id": str(p.run_id),
            "findings": len(rows),
            "outcome": outcome,
            "degraded": llm is None,
            "risk": risk,
            "timings": timings,
        },
    )
