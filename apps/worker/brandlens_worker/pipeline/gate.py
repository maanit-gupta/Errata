"""Stage 6: the citation gate (SPEC §8). An LLM finding is kept only if it cites retrieved items of
the right dimension, its quote is found locally, and it doesn't duplicate a deterministic finding.
Every drop is counted by reason."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Literal

from brandlens_worker.pipeline.confidence import agreement, confidence, spans_overlap
from brandlens_worker.pipeline.filters.base import cap_severity
from brandlens_worker.pipeline.llm_pass import LLMFinding
from brandlens_worker.pipeline.quotes import find_quote
from brandlens_worker.pipeline.types import Doc, Finding, Vault

DropReason = Literal[
    "no_valid_citation",  # step 1: none of the cited codes were retrieved for this run
    "dimension_mismatch",  # step 2
    "quote_not_found",  # step 3
    "duplicate_deterministic",  # step 5
    "duplicate_llm",  # two LLM findings for the same issue
]


@dataclass
class GateResult:
    accepted: list[Finding]
    drops: Counter[str] = field(default_factory=Counter)
    unknown_codes: int = 0  # cited codes that were dropped (finding may survive on others)


def _cited_dimension(item: dict[str, Any], vault: Vault) -> set[str]:
    if item["kind"] == "fact":
        fact = next((f for f in vault.facts if f.id == item["id"]), None)
        return {"facts", "claims"} if fact and fact.required_disclaimer else {"facts"}
    return {str(item["dimension"])}


def gate(
    llm: list[LLMFinding],
    *,
    doc: Doc,
    retrieved: list[dict[str, Any]],
    vault: Vault,
    deterministic: list[Finding],
    confirmation: list[LLMFinding] | None,
    model_version: str | None = None,
    prompt_version: str | None = None,
) -> GateResult:
    result = GateResult(accepted=[])
    by_code = {str(r["code"]).upper(): r for r in retrieved}
    claimed: dict[str, list[tuple[int, int]]] = {}

    # Spans of the confirmation sample, for agreement on blockers.
    confirm_spans: list[tuple[str, tuple[int, int]]] | None = None
    if confirmation is not None:
        confirm_spans = []
        for c in confirmation:
            span = find_quote(doc.text, c.quote)
            if span:
                confirm_spans.append((c.dimension, span))

    for f in llm:
        # 1. resolve citations against this run's retrieved items
        codes = [c.strip().upper() for c in f.cites]
        items = [by_code[c] for c in codes if c in by_code]
        result.unknown_codes += len(codes) - len(items)
        if not items:
            result.drops["no_valid_citation"] += 1
            continue
        # 2. at least one cited item matches the finding's dimension
        if not any(f.dimension in _cited_dimension(i, vault) for i in items):
            result.drops["dimension_mismatch"] += 1
            continue
        # 3. quote found locally (first unclaimed occurrence for this dimension)
        span = find_quote(doc.text, f.quote, claimed.get(f.dimension, []))
        if span is None:
            result.drops["quote_not_found"] += 1
            continue
        # 5. deterministic findings win on overlap
        if any(
            d.dimension == f.dimension and spans_overlap(span, (d.start, d.end))
            for d in deterministic
        ):
            result.drops["duplicate_deterministic"] += 1
            continue
        if any(
            a.dimension == f.dimension and spans_overlap(span, (a.start, a.end))
            for a in result.accepted
        ):
            result.drops["duplicate_llm"] += 1
            continue
        claimed.setdefault(f.dimension, []).append(span)

        # 4. severity clamp (precision gate)
        severity = cap_severity(f.dimension, f.severity)
        rule = next((i for i in items if i["kind"] == "rule"), None)
        fact = next((i for i in items if i["kind"] == "fact"), None)
        primary = {i["code"] for i in (rule, fact) if i}
        extra = [i["code"] for i in items if i["code"] not in primary]
        explanation = f.explanation.strip() + (f" Also cites: {', '.join(extra)}." if extra else "")
        agree = agreement(severity, f.dimension, span, confirm_spans)
        result.accepted.append(
            Finding(
                dimension=f.dimension,
                start=span[0],
                end=span[1],
                severity=severity,
                explanation=explanation,
                rule_id=str(rule["id"]) if rule else None,
                fact_id=str(fact["id"]) if fact else None,
                codes=[str(i["code"]) for i in items],
                rewrite=f.rewrite.strip() if f.rewrite and f.rewrite.strip() else None,
                source="llm",
                confidence=confidence((float(i["similarity"]) for i in items), agree),
            )
        )
    return result
