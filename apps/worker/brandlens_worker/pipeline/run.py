"""Run stages 1-4 on one version (pure orchestration; I/O is injected by the job)."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import numpy.typing as npt

from brandlens_worker.pipeline.filters import run_filters
from brandlens_worker.pipeline.ingest import ingest
from brandlens_worker.pipeline.protect import protect
from brandlens_worker.pipeline.retrieve import build_queries, merge, to_retrieved
from brandlens_worker.pipeline.types import Doc, Finding, RedactedDoc, Vault

Embed = Callable[[list[str]], Awaitable[npt.NDArray[np.float32]]]
MatchVault = Callable[[npt.NDArray[np.float32]], Awaitable[list[dict[str, Any]]]]


@dataclass
class VersionInput:
    format: str
    body: str | None = None
    data: bytes | None = None
    intent: dict[str, Any] = field(default_factory=dict)


@dataclass
class StagesResult:
    doc: Doc
    redacted: RedactedDoc
    findings: list[Finding]
    retrieved: list[dict[str, Any]]
    timings: dict[str, int]


def _ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


async def run_stages_1_to_4(
    version: VersionInput, vault: Vault, *, embed: Embed, match_vault: MatchVault, topk: int
) -> StagesResult:
    timings: dict[str, int] = {}

    t = time.perf_counter()
    doc = ingest(version.format, body=version.body, data=version.data)
    timings["ingest"] = _ms(t)

    t = time.perf_counter()
    redacted = protect(doc)
    timings["protect"] = _ms(t)

    t = time.perf_counter()
    findings = run_filters(doc, vault)
    timings["filters"] = _ms(t)

    t = time.perf_counter()
    queries = build_queries(doc.text)
    vectors = await embed(queries)
    results = [await match_vault(vec) for vec in vectors]
    retrieved = to_retrieved(merge(results, limit=topk * 2))
    timings["retrieve"] = _ms(t)

    return StagesResult(doc, redacted, findings, retrieved, timings)


@dataclass
class LLMStageResult:
    findings: list[Finding]
    drops: dict[str, int]
    rewrite_failures: dict[str, int]
    provider: str
    model_version: str
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
    import asyncio

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
