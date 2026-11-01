"""Hero 4 (cross-modal reconciliation) on 20 labelled posts plus a real OCR'd image.
PASS IF: >= 9 of 10 conflicting posts flagged citing both spans, 0 flags on 10 consistent posts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pytest

from brandlens_worker.pipeline.cross_modal import CHECK_VERSION, Surface, check_cross_modal
from brandlens_worker.pipeline.image import analyse_rgb, image_doc
from brandlens_worker.pipeline.ingest import ingest
from brandlens_worker.pipeline.run import VersionInput
from brandlens_worker.pipeline.types import Finding
from tests.kit_fixture import kit
from tests.vault_fixture import paywise_vault

POSTS: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "fixtures" / "cross_modal_posts.json").read_text()
)["posts"]


def run(post: dict[str, Any]) -> tuple[list[Finding], dict[str, str]]:
    doc = ingest("text", body=post["document"])
    intent = {"caption": post["caption"], "landing_page_text": post["landing"]}
    others = VersionInput(format=post["format"], intent=intent).other_surfaces()
    texts = {"document": post["document"], **{s.name: s.text for s in others}}
    return check_cross_modal(doc, others, paywise_vault()), texts


def test_twenty_labelled_posts() -> None:
    assert len(POSTS) == 20 and sum(p["conflict"] for p in POSTS) == 10


@pytest.mark.parametrize("post", POSTS, ids=lambda p: p["id"])
def test_post(post: dict[str, Any]) -> None:
    found, texts = run(post)
    if not post["conflict"]:
        assert found == [], [f.explanation for f in found]
        return
    assert found, "conflict not flagged"
    f = found[0]
    # Cited: the applicable vault fact (never a hardcoded code), with its version recorded.
    assert f.cited and f.codes == [post["fact"]] and f.fact_id == f"fact-{post['fact']}"
    assert f.source == "deterministic" and f.check == CHECK_VERSION and f.severity == "blocker"
    # Both spans: the document span and the other surface's span, each quoting its own text.
    assert post["document"][f.start : f.end]
    other = f.counterpart
    assert other is not None and other["surface"] in texts
    assert texts[other["surface"]][other["start"] : other["end"]] == other["quote"]


def test_pass_if_summary() -> None:
    flagged = sum(bool(run(p)[0]) for p in POSTS if p["conflict"])
    false_flags = sum(bool(run(p)[0]) for p in POSTS if not p["conflict"])
    assert flagged >= 9 and false_flags == 0, (flagged, false_flags)


def test_no_applicable_fact_means_no_finding() -> None:
    # Two surfaces disagree about a percentage no vault fact is about: nothing to cite, no flag.
    doc = ingest("text", body="Cashback 5% this week")
    assert (
        check_cross_modal(doc, [Surface("caption", "Cashback 7% this week")], paywise_vault()) == []
    )


def test_expired_and_other_campaign_facts_are_never_cited() -> None:
    # Oct 18 is Navratri's E-11 (another campaign, expired): it must not become the citation.
    doc = ingest("text", body="Investor meet Oct 18")
    found = check_cross_modal(doc, [Surface("caption", "Investor meet Oct 28")], paywise_vault())
    assert all("E-11" not in f.codes for f in found)


def test_text_drafts_never_compare_a_caption_field() -> None:
    v = VersionInput(format="text", intent={"caption": "Oct 18", "landing_page_text": "Oct 28"})
    assert [s.name for s in v.other_surfaces()] == ["landing_page"]


def test_real_ocr_banner_against_the_caption() -> None:
    """Render a banner, OCR it with the real stage-1 engine, and compare with the caption."""
    img = np.full((240, 900, 3), 248, dtype=np.uint8)
    cv2.putText(
        img, "WEBINAR OCT 18, 7 PM", (30, 140), cv2.FONT_HERSHEY_DUPLEX, 2.0, (20, 20, 20), 4
    )
    analysis = analyse_rgb(img, kit())
    doc = image_doc(analysis, b"")
    if "18" not in doc.text:
        pytest.skip(f"OCR engine didn't read the rendered banner: {doc.text!r}")
    found = check_cross_modal(doc, [Surface("caption", "Join us Oct 28 at 7 PM")], paywise_vault())
    assert [f.codes for f in found] == [["E-19"]]
    assert found[0].bbox is not None  # anchored on the banner text in the image
