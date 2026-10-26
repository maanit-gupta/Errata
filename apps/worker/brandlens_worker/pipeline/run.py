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
