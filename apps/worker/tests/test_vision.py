"""P11 image checks against fixtures/paywise/creatives/labels.json (no network, no LLM)."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from brandlens_worker.llm.cache import LLMCache
from brandlens_worker.llm.router import LLMRouter
from brandlens_worker.pipeline.image import (
    ImageAnalysis,
    VisualKit,
    analyse_image,
    check_image,
    image_doc,
    llm_image,
)
from brandlens_worker.pipeline.llm_pass import VisionFinding
from brandlens_worker.pipeline.run import VersionInput, run_stages_1_to_4, run_stages_5_6
from brandlens_worker.pipeline.types import Finding
from brandlens_worker.pipeline.vision_gate import vision_gate
from brandlens_worker.vision import decode_image
from brandlens_worker.vision.colour import PaletteColour, delta_e
from brandlens_worker.vision.contrast import contrast_ratio, hex_to_rgb
from brandlens_worker.vision.logo import load_template
from brandlens_worker.vision.ocr import OcrWord, group_lines
from tests.fakes import ScriptedProvider
from tests.vault_fixture import ROOT, d, paywise_vault

KIT_DIR = ROOT / "fixtures" / "paywise"
CREATIVES = KIT_DIR / "creatives"
LABELS: list[dict[str, Any]] = json.loads((CREATIVES / "labels.json").read_text())["creatives"]
INTENT = {"goal": "webinar sign-ups", "audience": "first-time investors", "cta": "Register now",
          "channel": "instagram_post"}  # fmt: skip


@cache
def kit() -> VisualKit:
    logos = [
        load_template(a["name"], (KIT_DIR / "logos" / Path(a["storage_path"]).name).read_bytes())
        for a in d.ASSETS
        if a["kind"] == "logo"
    ]
    palette = [PaletteColour(c["name"], c["hex"]) for c in d.PALETTE]
    return VisualKit(logos=logos, palette=palette)


@cache
def analysed(file: str) -> ImageAnalysis:
    return analyse_image((CREATIVES / file).read_bytes(), kit())


def checks(findings: list[Finding]) -> set[str]:
    """Name each deterministic image finding the way labels.json does."""
    out = set()
    for f in findings:
        if f.wcag_ref == "1.1.1":
            out.add("alt_missing")
        elif f.quote == "No PayWise logo found":
            out.add("logo_missing")
        elif f.quote and f.quote.startswith("Logo,"):
            out.add("logo_small")
        elif f.quote == "Logo clear space":
            out.add("logo_clear_space")
        elif f.quote and f.quote.startswith("Fill #"):
            out.add("off_palette")
        elif f.dimension == "access" and "hidden" in f.explanation:
            out.add("hidden_text")
        elif f.wcag_ref == "1.4.3":
            out.add("contrast")
    return out


def iou(a: list[int] | tuple[int, ...], b: list[int] | tuple[int, ...]) -> float:
    w = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    h = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - w * h
    return w * h / union


# ------------------------------------------------------------------ formulas


@pytest.mark.parametrize(
    ("fg", "bg", "expected"),
    [  # values shown by WebAIM's contrast checker
        ("#777777", "#FFFFFF", 4.48),
        ("#767676", "#FFFFFF", 4.54),
        ("#000000", "#FFFFFF", 21.0),
        ("#FFFFFF", "#FFFFFF", 1.0),
        ("#0000FF", "#FFFFFF", 8.59),
        ("#FF0000", "#FFFFFF", 4.0),
    ],
)
def test_contrast_ratio_matches_webaim(fg: str, bg: str, expected: float) -> None:
    assert round(contrast_ratio(hex_to_rgb(fg), hex_to_rgb(bg)), 2) == expected


def test_delta_e_ciede2000_reference_pair() -> None:
    from skimage.color import deltaE_ciede2000

    # Sharma, Wu & Dalal (2005) CIEDE2000 test data, pair 1.
    ref = deltaE_ciede2000(np.array([50, 2.6772, -79.7751]), np.array([50, 0, -82.7485]))
    assert float(ref) == pytest.approx(2.0425, abs=1e-4)
    assert delta_e((20, 20, 20), (20, 20, 20)) == 0
    assert delta_e(hex_to_rgb("#F8F7F4"), hex_to_rgb("#FFFFFF")) < 3
    assert delta_e(hex_to_rgb("#1E8C93"), hex_to_rgb("#2F6B3A")) > 10


def test_group_lines_joins_a_row_and_splits_columns() -> None:
    words = [
        OcrWord("SIP", (635, 182, 734, 232), 96),
        OcrWord("Start", (112, 182, 260, 244), 96),
        OcrWord("now", (322, 761, 401, 786), 96),
        OcrWord("your", (270, 190, 411, 244), 96),
        OcrWord("Diwali", (434, 183, 611, 232), 96),
        OcrWord("Register", (152, 754, 310, 794), 96),
        OcrWord("NORTHFUND", (900, 186, 1000, 230), 96),  # far right: its own line
    ]
    assert [ln.text for ln in group_lines(words)] == [
        "Start your Diwali SIP",
        "NORTHFUND",
        "Register now",
    ]


# ------------------------------------------------------------------ fixtures (labels.json)


@pytest.mark.parametrize("label", LABELS, ids=lambda c: c["file"])
def test_creative_checks_match_labels(label: dict[str, Any]) -> None:
    a = analysed(label["file"])
    doc = image_doc(a, b"")
    found = check_image(a, doc, kit(), paywise_vault(), label["alt_text"])
    assert all(f.cited for f in found)
    assert checks(found) == {e["check"] for e in label["expected"] if e["check"] != "cold_cast"}
    for e in label["expected"]:
        if e["check"] in ("cold_cast", "alt_missing"):
            continue
        assert any(e["code"] in f.codes for f in found), e


def test_logo_detection_rate_and_boxes() -> None:
    present = [c for c in LABELS if c["logo_present"]]
    hits = [c for c in present if analysed(c["file"]).logo is not None]
    assert len(hits) == len(present) >= 9
    for c in hits:
        logo = analysed(c["file"]).logo
        assert logo is not None and iou(logo.box, c["logo_box"]) > 0.85, c["file"]
    assert all(analysed(c["file"]).logo is None for c in LABELS if not c["logo_present"])


def test_contrast_within_a_tenth_of_webaim() -> None:
    pairs = 0
    for c in LABELS:
        a = analysed(c["file"])
        for t in c["texts"]:
            if t["size_px"] < 16:
                continue  # tiny fine print is flagged as hidden, not measured precisely
            expected = contrast_ratio(hex_to_rgb(t["fg"]), hex_to_rgb(t["bg"]))
            for line, tc in zip(a.lines, a.contrasts, strict=True):
                if tc and iou(line.box, t["box"]) > 0.3:
                    assert abs(tc.ratio - expected) <= 0.1, (c["file"], t["text"], tc.ratio)
                    pairs += 1
    assert pairs >= 20


def test_ocr_reads_inverted_faint_and_partner_text() -> None:
    assert "Register now" in image_doc(analysed("01-good.png"), b"").text
    assert "NORTHFUND" in image_doc(analysed("10-two-logos.png"), b"").text
    hidden = image_doc(analysed("09-hidden-text.png"), b"").text
    assert "Returns guaranteed" in hidden
    # the logo's own lettering is artwork, not copy
    assert "PayWise" not in image_doc(analysed("01-good.png"), b"").text


def test_warmth_prefilter() -> None:
    assert analysed("07-cold-blue.png").warmth.cool
    assert not any(
        analysed(c["file"]).warmth.cool for c in LABELS if c["file"] != "07-cold-blue.png"
    )


def test_text_filters_run_on_image_text() -> None:
    """The hidden fine print promises guaranteed returns: CL-03 fires on the OCR text."""
    from brandlens_worker.pipeline.filters import run_filters

    doc = image_doc(analysed("09-hidden-text.png"), b"")
    found = run_filters(doc, paywise_vault())
    claims = [f for f in found if f.dimension == "claims"]
    assert claims and "guaranteed" in doc.text[claims[0].start : claims[0].end].lower()
    box = doc.bbox_for(claims[0].start, claims[0].end)
    assert box is not None and box[1] > 980  # the fine print sits at the bottom


def test_llm_image_masks_redactions_and_downscales() -> None:
    a = analysed("01-good.png")
    doc = image_doc(a, b"")
    start = doc.text.index("Register now")
    png = llm_image(a, doc, [(start, start + len("Register now"))])
    small = decode_image(png)
    assert max(small.shape[:2]) <= 1024
    box = doc.bbox_for(start, start + len("Register now"))
    assert box is not None
    scale = small.shape[1] / a.rgb.shape[1]
    cx, cy = int((box[0] + box[2]) / 2 * scale), int((box[1] + box[3]) / 2 * scale)
    assert np.all(small[cy, cx] == 0)


# ------------------------------------------------------------------ vision gate


RETRIEVED = [
    {"id": "rule-VS-02", "code": "VS-02", "kind": "rule", "dimension": "visual", "similarity": 0.6},
    {"id": "rule-VS-03", "code": "VS-03", "kind": "rule", "dimension": "visual", "similarity": 0.5},
    {"id": "rule-A-02", "code": "A-02", "kind": "rule", "dimension": "access", "similarity": 0.55},
    {"id": "rule-CL-03", "code": "CL-03", "kind": "rule", "dimension": "claims", "similarity": 0.7},
]
ALT = "PayWise poster about a SIP."


def vf(**kw: Any) -> VisionFinding:
    base: dict[str, Any] = {"target": "image", "dimension": "visual", "cites": ["VS-02"],
                            "severity": "warning", "explanation": "Cold blue cast."}  # fmt: skip
    return VisionFinding.model_validate({**base, **kw})


def run_vision_gate(findings: list[VisionFinding], *, style_check: bool = True) -> Any:
    a = analysed("09-hidden-text.png")
    return vision_gate(
        findings,
        doc=image_doc(a, b""),
        retrieved=RETRIEVED,
        vault=paywise_vault(),
        deterministic=[],
        confirmation=None,
        whole_image=a.whole,
        alt_text=ALT,
        style_check=style_check,
        owned_rule_ids={"rule-VS-03", "rule-VS-01"},
    )


def test_vision_gate_image_target() -> None:
    kept = run_vision_gate([vf()])
    assert len(kept.accepted) == 1
    f = kept.accepted[0]
    assert (f.target, f.bbox, f.quote, f.rule_id) == (
        "image",
        (0, 0, 1080, 1080),
        "Whole image",
        "rule-VS-02",
    )
    assert run_vision_gate([vf()], style_check=False).drops == {"prefilter": 1}
    assert run_vision_gate([vf(cites=["VS-03"])]).drops == {"deterministic_domain": 1}
    assert run_vision_gate([vf(dimension="tone", cites=["VS-02"])]).drops == {
        "dimension_mismatch": 1
    }
    assert run_vision_gate([vf(cites=["ZZ-1"])]).drops == {"no_valid_citation": 1}


def test_vision_gate_alt_text_and_text_targets() -> None:
    alt = vf(target="alt_text", dimension="access", cites=["A-02"], quote="about a SIP",
             rewrite="PayWise Diwali SIP poster. Register now.")  # fmt: skip
    text = vf(target="text", dimension="claims", cites=["CL-03"], quote="Returns guaranteed",
              severity="blocker", explanation="Guarantee on a market-linked product.")  # fmt: skip
    missing = vf(target="alt_text", dimension="access", cites=["A-02"], quote="not in the alt")
    kept = run_vision_gate([alt, text, missing])
    by_target = {f.target: f for f in kept.accepted}
    assert by_target["alt_text"].wcag_ref == "1.1.1"
    assert ALT[by_target["alt_text"].start : by_target["alt_text"].end] == "about a SIP"
    assert by_target["text"].dimension == "claims"
    assert kept.drops == {"quote_not_found": 1}


# ------------------------------------------------------------------ stages end to end


async def fake_embed(texts: list[str]) -> Any:
    return np.zeros((len(texts), 384), np.float32)


async def fake_match(_vec: Any) -> list[dict[str, Any]]:
    return [dict(r) for r in RETRIEVED]


async def test_image_through_stages_1_to_6() -> None:
    data = (CREATIVES / "07-cold-blue.png").read_bytes()
    stages = await run_stages_1_to_4(
        VersionInput(format="image", data=data, intent={**INTENT, "alt_text": ALT}, kit=kit()),
        paywise_vault(),
        embed=fake_embed,
        match_vault=fake_match,
        topk=8,
    )
    assert stages.image is not None and stages.image.warmth.cool
    assert "Your money, your pace." in stages.doc.text
    assert not [f for f in stages.findings if f.wcag_ref == "1.1.1"]  # alt text present

    provider = ScriptedProvider(
        "groq",
        [{"findings": [{"target": "image", "dimension": "visual", "cites": ["VS-02"],
                        "severity": "warning", "explanation": "Cold blue cast."}]}],
    )  # fmt: skip
    out = await run_stages_5_6(
        stages,
        paywise_vault(),
        INTENT,
        router=LLMRouter([provider], cache=LLMCache(enabled=False)),
        embed_sync=None,
    )
    assert provider.calls == 1  # one vision call per image
    assert out.prompt_version == "vision@1"
    assert [(f.target, f.codes) for f in out.findings] == [("image", ["VS-02"])]


async def test_vision_pass_skipped_when_nothing_to_judge() -> None:
    """A warm image with no text and no alt text makes no LLM call at all."""
    import cv2

    blank = np.full((400, 400, 3), (244, 247, 248), np.uint8)  # Paper, BGR
    ok, buf = cv2.imencode(".png", blank)
    assert ok
    stages = await run_stages_1_to_4(
        VersionInput(format="image", data=buf.tobytes(), intent=INTENT, kit=kit()),
        paywise_vault(),
        embed=fake_embed,
        match_vault=fake_match,
        topk=8,
    )
    provider = ScriptedProvider("groq", [])
    out = await run_stages_5_6(
        stages,
        paywise_vault(),
        INTENT,
        router=LLMRouter([provider], cache=LLMCache(enabled=False)),
        embed_sync=None,
    )
    assert provider.calls == 0 and out.provider is None and out.findings == []
    assert {"logo_missing", "alt_missing"} <= checks(stages.findings)
