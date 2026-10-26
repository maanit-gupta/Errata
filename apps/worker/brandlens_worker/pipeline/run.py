"""Run stages 1-4 on one version (pure orchestration; I/O is injected by the job)."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import numpy.typing as npt

from brandlens_worker import config
from brandlens_worker.pipeline.filters import run_filters
from brandlens_worker.pipeline.image import (
    ImageAnalysis,
    VisualKit,
    analyse_image,
    check_image,
    image_doc,
    logo_rule,
    palette_rule,
)
from brandlens_worker.pipeline.ingest import IngestError, ingest
from brandlens_worker.pipeline.protect import protect
from brandlens_worker.pipeline.retrieve import build_queries, merge, to_retrieved
from brandlens_worker.pipeline.types import Doc, Finding, RedactedDoc, Vault

Embed = Callable[[list[str]], Awaitable[npt.NDArray[np.float32]]]
MatchVault = Callable[[npt.NDArray[np.float32]], Awaitable[list[dict[str, Any]]]]


# Extra retrieval queries for images, so the visual and image-accessibility rules are always
# candidates (an image may carry little or no text to retrieve on).
IMAGE_QUERIES = (
    "Image style: warm palette, photography, cold blue casts",
    "Logo usage, clear space and minimum size; approved palette colours",
    "Text contrast in images and alternative text for images",
)


@dataclass
class VersionInput:
    format: str
    body: str | None = None
    data: bytes | None = None
    intent: dict[str, Any] = field(default_factory=dict)
    kit: VisualKit | None = None
    ocr_engine: str = "tesseract"

    @property
    def alt_text(self) -> str | None:
        alt = self.intent.get("alt_text")
        return alt.strip() if isinstance(alt, str) and alt.strip() else None


@dataclass
class StagesResult:
    doc: Doc
    redacted: RedactedDoc
    findings: list[Finding]
    retrieved: list[dict[str, Any]]
    timings: dict[str, int]
    image: ImageAnalysis | None = None
    kit: VisualKit | None = None
    alt_text: str | None = None


def _ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


async def run_stages_1_to_4(
    version: VersionInput, vault: Vault, *, embed: Embed, match_vault: MatchVault, topk: int
) -> StagesResult:
    timings: dict[str, int] = {}

    image: ImageAnalysis | None = None
    kit = version.kit or VisualKit()

    t = time.perf_counter()
    if version.format == "image":
        if not version.data:
            raise IngestError("missing_file")
        try:
            image = await asyncio.to_thread(
                analyse_image, version.data, kit, ocr_engine=version.ocr_engine
            )
        except ValueError as exc:
            raise IngestError("unreadable_image") from exc
        doc = image_doc(image, version.data)
        if doc.word_count > config.MAX_WORDS:
            raise IngestError("too_long")
    else:
        doc = ingest(version.format, body=version.body, data=version.data)
    timings["ingest"] = _ms(t)

    t = time.perf_counter()
    redacted = protect(doc)
    timings["protect"] = _ms(t)

    t = time.perf_counter()
    findings = run_filters(doc, vault) if doc.text.strip() else []
    if image is not None:
        findings += await asyncio.to_thread(check_image, image, doc, kit, vault, version.alt_text)
    timings["filters"] = _ms(t)

    t = time.perf_counter()
    queries = build_queries(doc.text) if doc.text.strip() else []
    if image is not None:
        queries += [q for q in (version.alt_text, *IMAGE_QUERIES) if q]
    vectors = await embed(queries)
    results = [await match_vault(vec) for vec in vectors]
    retrieved = to_retrieved(merge(results, limit=topk * 2))
    timings["retrieve"] = _ms(t)

    return StagesResult(
        doc, redacted, findings, retrieved, timings, image, kit if image else None, version.alt_text
    )


@dataclass
class LLMStageResult:
    findings: list[Finding]
    drops: dict[str, int]
    rewrite_failures: dict[str, int]
    provider: str | None  # None when the vision pass had nothing to judge and was skipped
    model_version: str | None
    prompt_version: str
    timings: dict[str, int]
    generations: list[dict[str, Any]]


async def run_stages_5_6(
    stages: StagesResult,
    vault: Vault,
    intent: dict[str, Any],
    *,
    router: Any,
    embed_sync: Callable[[list[str]], npt.NDArray[np.float32]] | None,
) -> LLMStageResult:
    """LLM pass + citation gate + intent verification. Raises DegradedError if no provider works."""
    if stages.image is not None:
        return await _run_vision_5_6(stages, vault, intent, router=router, embed_sync=embed_sync)

    from brandlens_worker.pipeline.gate import gate
    from brandlens_worker.pipeline.intent import verify_all
    from brandlens_worker.pipeline.llm_pass import build_user_message, run_llm_pass
    from brandlens_worker.prompts import load_prompt

    timings: dict[str, int] = {}
    system, prompt_version = load_prompt("review")
    user = build_user_message(
        stages.redacted, intent, vault, stages.retrieved, stages.findings, stages.doc
    )

    t = time.perf_counter()
    llm = await run_llm_pass(router, system, prompt_version, user)
    timings["llm"] = _ms(t)

    t = time.perf_counter()
    gated = gate(
        llm.findings,
        doc=stages.doc,
        retrieved=stages.retrieved,
        vault=vault,
        deterministic=stages.findings,
        confirmation=llm.confirmation,
    )
    failures = await asyncio.to_thread(
        verify_all,
        gated.accepted,
        stages.doc,
        vault,
        intent,
        embed=embed_sync,
        baseline=stages.findings,
    )
    timings["gate"] = _ms(t)

    generations = [
        {"name": "review", "meta": llm.meta, "findings": len(llm.findings)},
    ]
    if llm.confirmation_meta is not None:
        generations.append(
            {
                "name": "review_confirm",
                "meta": llm.confirmation_meta,
                "findings": len(llm.confirmation or []),
            }
        )
    return LLMStageResult(
        findings=gated.accepted,
        drops=dict(gated.drops)
        | ({"unknown_codes": gated.unknown_codes} if gated.unknown_codes else {}),
        rewrite_failures=dict(failures),
        provider=llm.meta.provider,
        model_version=llm.meta.model,
        prompt_version=prompt_version,
        timings=timings,
        generations=generations,
    )


async def _run_vision_5_6(
    stages: StagesResult,
    vault: Vault,
    intent: dict[str, Any],
    *,
    router: Any,
    embed_sync: Callable[[list[str]], npt.NDArray[np.float32]] | None,
) -> LLMStageResult:
    """One vision call per image (invariant 4): the picture, its OCR text and its alt text.
    Skipped when there is nothing to judge (no text, no alt text, not pre-filtered as cold)."""
    from brandlens_worker.llm.base import Image
    from brandlens_worker.pipeline.image import llm_image
    from brandlens_worker.pipeline.intent import verify_all
    from brandlens_worker.pipeline.llm_pass import (
        VisionReviewOutput,
        build_vision_message,
        run_llm_pass,
    )
    from brandlens_worker.pipeline.vision_gate import vision_gate
    from brandlens_worker.prompts import load_prompt

    assert stages.image is not None
    image = stages.image
    system, prompt_version = load_prompt("vision")
    style_check = image.warmth.cool
    if not (stages.doc.text.strip() or stages.alt_text or style_check):
        return LLMStageResult([], {}, {}, None, None, prompt_version, {"llm": 0}, [])

    timings: dict[str, int] = {}
    signals = {
        "style_check": style_check,
        "warmth": "cool" if style_check else "neutral or warm",
        "mean_b_star": round(image.warmth.mean_b, 1),
    }
    user = build_vision_message(
        stages.redacted,
        intent,
        vault,
        stages.retrieved,
        stages.findings,
        stages.doc,
        alt_text=stages.alt_text,
        signals=signals,
    )
    redacted_spans = [(r.start, r.end) for r in stages.redacted.redactions]
    png = await asyncio.to_thread(llm_image, image, stages.doc, redacted_spans)

    t = time.perf_counter()
    llm = await run_llm_pass(
        router,
        system,
        prompt_version,
        user,
        schema=VisionReviewOutput,
        images=[Image(png, "image/png")],
    )
    timings["llm"] = _ms(t)

    t = time.perf_counter()
    owned = {r.id for r in (logo_rule(vault), palette_rule(vault)) if r}
    gated = vision_gate(
        llm.findings,
        doc=stages.doc,
        retrieved=stages.retrieved,
        vault=vault,
        deterministic=stages.findings,
        confirmation=llm.confirmation,
        whole_image=image.whole,
        alt_text=stages.alt_text,
        style_check=style_check,
        owned_rule_ids=owned,
    )
    text_findings = [f for f in gated.accepted if f.target == "text"]
    failures = await asyncio.to_thread(
        verify_all,
        text_findings,
        stages.doc,
        vault,
        intent,
        embed=embed_sync,
        baseline=stages.findings,
    )
    timings["gate"] = _ms(t)

    generations = [{"name": "vision", "meta": llm.meta, "findings": len(llm.findings)}]
    if llm.confirmation_meta is not None:
        generations.append(
            {
                "name": "vision_confirm",
                "meta": llm.confirmation_meta,
                "findings": len(llm.confirmation or []),
            }
        )
    return LLMStageResult(
        findings=gated.accepted,
        drops=dict(gated.drops)
        | ({"unknown_codes": gated.unknown_codes} if gated.unknown_codes else {}),
        rewrite_failures=dict(failures),
        provider=llm.meta.provider,
        model_version=llm.meta.model,
        prompt_version=prompt_version,
        timings=timings,
        generations=generations,
    )
