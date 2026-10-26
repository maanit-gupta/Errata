"""The labelled fixture deck and how a finding is matched to a label (shared by test_pdf and
eval/pdf_eval.py; no pytest import)."""

from __future__ import annotations

import json
from typing import Any

from brandlens_worker.pipeline.types import Doc, Finding
from brandlens_worker.vision import overlap_fraction
from tests.kit_fixture import KIT_DIR, RETRIEVED

DECK = (KIT_DIR / "deck.pdf").read_bytes()
LABELS: dict[str, Any] = json.loads((KIT_DIR / "deck_labels.json").read_text())


async def fake_match(_vec: Any) -> list[dict[str, Any]]:
    return [dict(r) for r in RETRIEVED] + [
        {"id": "rule-TV-02", "code": "TV-02", "kind": "rule", "dimension": "tone",
         "similarity": 0.6},
    ]  # fmt: skip


def page_and_box(f: Finding, doc: Doc) -> tuple[int | None, tuple[int, int, int, int] | None]:
    if f.target == "image":
        return f.page, f.bbox
    return doc.page_for(f.start, f.end), f.bbox or doc.bbox_for(f.start, f.end)


def matches(f: Finding, doc: Doc, label: dict[str, Any]) -> bool:
    """Same page, dimension and citation, and the boxes overlap by ≥ 50% of the smaller one."""
    page, box = page_and_box(f, doc)
    if page != label["page"] or f.dimension != label["dimension"] or box is None:
        return False
    if "code" in label and label["code"] not in f.codes:
        return False
    if "wcag" in label and f.wcag_ref != label["wcag"]:
        return False
    lb = tuple(label["box"])
    return max(overlap_fraction(lb, box), overlap_fraction(box, lb)) >= 0.5  # type: ignore[arg-type]
