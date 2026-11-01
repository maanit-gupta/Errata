"""Hero 3 (visual auto-heal): palette-only contrast fixes, on 20 labelled samples and a real
creative. PASS IF: every fix comes from the palette and reaches 4.5:1 (3:1 large); none applied
without Accept (the worker only ever writes `applied: false`; acceptance is the finding status)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from brandlens_worker.pipeline.image import check_image, image_doc
from brandlens_worker.vision.autoheal import suggest_fix
from brandlens_worker.vision.colour import PaletteColour
from brandlens_worker.vision.contrast import contrast_ratio, hex_to_rgb
from tests.kit_fixture import kit
from tests.test_vision import analysed
from tests.vault_fixture import paywise_vault

DATA = json.loads((Path(__file__).parent / "fixtures" / "autoheal_samples.json").read_text())
PALETTES = {k: [PaletteColour(n, h) for n, h in v] for k, v in DATA["palettes"].items()}
SAMPLES: list[dict[str, Any]] = DATA["samples"]


def test_there_are_20_labelled_samples() -> None:
    assert len(SAMPLES) == 20
    assert len({s["id"] for s in SAMPLES}) == 20


@pytest.mark.parametrize("s", SAMPLES, ids=lambda s: s["id"])
def test_sample(s: dict[str, Any]) -> None:
    required = 3.0 if s["large"] else 4.5
    palette = PALETTES[s["palette"]]
    allowed = {c.hex.upper() for c in palette}
    assert contrast_ratio(hex_to_rgb(s["text"]), hex_to_rgb(s["bg"])) < required  # it fails today
    fix = suggest_fix(s["text"], s["bg"], palette, large=s["large"])
    assert (fix is not None) == s["expect_fix"]
    if fix is None:
        return
    # Every colour that changed comes from the palette; unchanged ones are the originals.
    assert fix.healed_text_hex in allowed | {s["text"].upper()}
    assert fix.healed_bg_hex in allowed | {s["bg"].upper()}
    assert (fix.healed_text_hex, fix.healed_bg_hex) != (s["text"].upper(), s["bg"].upper())
    # It passes on the unrounded ratio, recomputed here.
    ratio = contrast_ratio(hex_to_rgb(fix.healed_text_hex), hex_to_rgb(fix.healed_bg_hex))
    assert ratio >= required and fix.required_ratio == required
    assert fix.to_json()["applied"] is False and fix.to_json()["source"] == "palette"


def test_summary_of_the_labelled_set() -> None:
    fixes = [
        suggest_fix(s["text"], s["bg"], PALETTES[s["palette"]], large=s["large"]) for s in SAMPLES
    ]
    assert sum(f is not None for f in fixes) == 18  # the 2 pastel-only cases have no on-brand fix


def test_background_strategy_when_no_text_colour_passes() -> None:
    # Light-grey background: neither light palette colour passes as text on it, but the dark
    # text passes once the background becomes a palette colour.
    palette = [PaletteColour("Paper", "#F8F7F4"), PaletteColour("Sand", "#E9DFC9")]
    fix = suggest_fix("#333333", "#9A9A9A", palette, large=False)
    assert fix is not None and fix.strategy == "background"
    assert fix.healed_text_hex == "#333333" and fix.healed_bg_hex in {"#F8F7F4", "#E9DFC9"}


def test_both_strategy_when_neither_side_alone_can_pass() -> None:
    palette = [PaletteColour("Navy", "#1B2A49"), PaletteColour("Cream", "#FFF6E0")]
    fix = suggest_fix("#808080", "#7A7A7A", palette, large=False)
    assert fix is not None and fix.strategy == "both"
    assert {fix.healed_text_hex, fix.healed_bg_hex} == {"#1B2A49", "#FFF6E0"}


def test_no_suggestion_when_it_already_passes_or_no_palette() -> None:
    palette = PALETTES["paywise"]
    assert suggest_fix("#141414", "#F8F7F4", palette, large=False) is None
    assert suggest_fix("#888888", "#FFFFFF", [], large=False) is None


def test_deterministic() -> None:
    a = [suggest_fix(s["text"], s["bg"], PALETTES[s["palette"]], large=s["large"]) for s in SAMPLES]
    b = [suggest_fix(s["text"], s["bg"], PALETTES[s["palette"]], large=s["large"]) for s in SAMPLES]
    assert a == b


def test_real_low_contrast_creative_gets_an_on_palette_preview() -> None:
    a = analysed("05-low-contrast.png")
    found = check_image(a, image_doc(a, b""), kit(), paywise_vault(), "Start a SIP")
    wcag = [f for f in found if f.wcag_ref == "1.4.3"]
    assert wcag, "the fixture has failing contrast"
    allowed = {c.hex.upper() for c in kit().palette}
    for f in wcag:
        fix = f.visual_fix
        assert fix is not None and fix["applied"] is False
        assert fix["healed_ratio"] >= fix["required_ratio"]
        changed = [
            h for h, o in ((fix["healed_text_hex"], fix["original_text_hex"]),
                           (fix["healed_bg_hex"], fix["original_bg_hex"])) if h != o
        ]  # fmt: skip
        assert changed and all(h in allowed for h in changed)
