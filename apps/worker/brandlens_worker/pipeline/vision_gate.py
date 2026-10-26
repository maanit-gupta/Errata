"""Stage 6 for images: the citation gate applied to the vision pass (SPEC §8 + P11).

- `target="text"` findings quote words read from the image; they go through the normal gate on
  the OCR Doc (citations retrieved, dimension match, quote found locally, deterministic wins).
- `target="image"` findings judge the picture's style. They must be `visual`, cite a retrieved
  visual rule the deterministic checks don't already own (logo, palette), and are only allowed
  when the warmth heuristic pre-filtered the image as a candidate (`style_check`).
- `target="alt_text"` findings must be `access`, cite a retrieved access rule, and their quote
  must be found in the alt text. They carry WCAG 1.1.1.

The model never supplies coordinates: image findings cover the whole image, text findings get the
union of their OCR word boxes at persistence, alt-text spans are computed locally.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from brandlens_worker.pipeline.confidence import confidence
from brandlens_worker.pipeline.filters.base import cap_severity
from brandlens_worker.pipeline.gate import GateResult, _cited_dimension, gate
from brandlens_worker.pipeline.llm_pass import VisionFinding
from brandlens_worker.pipeline.quotes import find_quote
from brandlens_worker.pipeline.types import Doc, Finding, Vault


def vision_gate(
    llm: list[VisionFinding],
    *,
    doc: Doc,
    retrieved: list[dict[str, Any]],
    vault: Vault,
    deterministic: list[Finding],
    confirmation: list[VisionFinding] | None,
    whole_image: tuple[int, int, int, int],
    alt_text: str | None,
    style_check: bool,
    owned_rule_ids: set[str],
) -> GateResult:
    text = [t for f in llm if (t := f.as_text_finding())]
    confirm_text = (
        [t for f in confirmation if (t := f.as_text_finding())]
        if confirmation is not None
        else None
    )
    result = gate(
        text,
        doc=doc,
        retrieved=retrieved,
        vault=vault,
        deterministic=deterministic,
        confirmation=confirm_text,
    )
    drops: Counter[str] = result.drops
    by_code = {str(r["code"]).upper(): r for r in retrieved}

    for f in llm:
        if f.target == "text":
            if not f.quote:
                drops["quote_not_found"] += 1
            continue
        codes = [c.strip().upper() for c in f.cites]
        items = [by_code[c] for c in codes if c in by_code]
        result.unknown_codes += len(codes) - len(items)
        if not items:
            drops["no_valid_citation"] += 1
            continue
        if not any(f.dimension in _cited_dimension(i, vault) for i in items):
            drops["dimension_mismatch"] += 1
            continue
        rule = next((i for i in items if i["kind"] == "rule"), None)
        if rule is None:
            drops["no_valid_citation"] += 1
            continue

        if f.target == "image":
            if f.dimension != "visual":
                drops["target_mismatch"] += 1
                continue
            if not style_check:
                drops["prefilter"] += 1  # the warmth heuristic didn't flag this image
                continue
            if str(rule["id"]) in owned_rule_ids:
                drops["deterministic_domain"] += 1  # logo/palette are measured, not judged
                continue
            if any(
                d.target == "image" and d.rule_id == str(rule["id"])
                for d in [*deterministic, *result.accepted]
            ):
                drops["duplicate_deterministic"] += 1
                continue
            start = end = 0
            bbox: tuple[int, int, int, int] | None = whole_image
            quote = "Whole image"
            wcag = None
        else:  # alt_text
            if f.dimension != "access":
                drops["target_mismatch"] += 1
                continue
            alt = (alt_text or "").strip()
            if not alt:
                drops["quote_not_found"] += 1
                continue
            span = find_quote(alt, f.quote) if f.quote else (0, len(alt))
            if span is None:
                drops["quote_not_found"] += 1
                continue
            if any(a.target == "alt_text" for a in result.accepted):
                drops["duplicate_llm"] += 1
                continue
            start, end = span
            bbox = None
            quote = alt[start:end]
            wcag = "1.1.1"

        severity = cap_severity(f.dimension, f.severity)
        fact = next((i for i in items if i["kind"] == "fact"), None)
        primary = {i["code"] for i in (rule, fact) if i}
        extra = [i["code"] for i in items if i["code"] not in primary]
        explanation = f.explanation.strip() + (f" Also cites: {', '.join(extra)}." if extra else "")
        result.accepted.append(
            Finding(
                dimension=f.dimension,
                start=start,
                end=end,
                severity=severity,
                explanation=explanation,
                rule_id=str(rule["id"]),
                fact_id=str(fact["id"]) if fact else None,
                wcag_ref=wcag,
                codes=[str(i["code"]) for i in items],
                rewrite=f.rewrite.strip() if f.rewrite and f.rewrite.strip() else None,
                source="llm",
                # Visual/access cap below blocker, so a single sample is the agreement (§7).
                confidence=confidence((float(i["similarity"]) for i in items), 1.0),
                target=f.target,
                bbox=bbox,
                quote=quote,
            )
        )
    return result
