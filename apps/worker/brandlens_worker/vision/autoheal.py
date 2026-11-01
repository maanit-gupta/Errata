"""Visual auto-heal (Round 3 extra, Hero 3): a palette-only contrast fix for a failing text line.

Deterministic WCAG math only (`vision/contrast.py`), no pixels rewritten and no model. Candidates
come **only** from the organisation's approved palette asset (no built-in black/white fallback),
so every suggestion is on-brand. The suggestion is stored on the WCAG 1.4.3 finding and shown as a
preview; nothing is applied unless a person presses Accept.

Search order, smallest visible change first:
1. keep the background, recolour the text with a palette colour;
2. keep the text, recolour the background;
3. recolour both.
Within a step, the candidate closest (CIEDE2000) to the original colour(s) wins; ties keep palette
order. A candidate must reach 4.5:1 (3:1 for large text) on the unrounded ratio. If no palette
colour or pair does, there is no suggestion.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

from brandlens_worker.vision.colour import PaletteColour, delta_e
from brandlens_worker.vision.contrast import contrast_ratio, hex_to_rgb, rgb_to_hex

Strategy = Literal["text", "background", "both"]


@dataclass(frozen=True)
class AutoHeal:
    original_text_hex: str
    original_bg_hex: str
    original_ratio: float
    healed_text_hex: str
    healed_text_name: str | None  # palette name; None when the original colour is kept
    healed_bg_hex: str
    healed_bg_name: str | None
    healed_ratio: float
    required_ratio: float
    strategy: Strategy

    def to_json(self) -> dict[str, Any]:
        return {**asdict(self), "source": "palette", "applied": False}


def _norm(hex_value: str) -> str:
    return rgb_to_hex(hex_to_rgb(hex_value))


def suggest_fix(
    text_hex: str, bg_hex: str, palette: list[PaletteColour], *, large: bool
) -> AutoHeal | None:
    """The smallest on-palette change that makes `text_hex` on `bg_hex` pass WCAG 1.4.3."""
    required = 3.0 if large else 4.5
    text_rgb, bg_rgb = hex_to_rgb(text_hex), hex_to_rgb(bg_hex)
    original = contrast_ratio(text_rgb, bg_rgb)
    colours = [(c.name, _norm(c.hex), hex_to_rgb(c.hex)) for c in palette]
    if original >= required or not colours:
        return None

    def made(t: tuple[str | None, str], b: tuple[str | None, str], how: Strategy) -> AutoHeal:
        ratio = contrast_ratio(hex_to_rgb(t[1]), hex_to_rgb(b[1]))
        return AutoHeal(
            original_text_hex=_norm(text_hex),
            original_bg_hex=_norm(bg_hex),
            original_ratio=round(original, 2),
            healed_text_hex=t[1],
            healed_text_name=t[0],
            healed_bg_hex=b[1],
            healed_bg_name=b[0],
            healed_ratio=round(ratio, 2),
            required_ratio=required,
            strategy=how,
        )

    # 1. recolour the text only
    text_only = [
        (delta_e(rgb, text_rgb), i, name, hx)
        for i, (name, hx, rgb) in enumerate(colours)
        if contrast_ratio(rgb, bg_rgb) >= required
    ]
    if text_only:
        _, _, name, hx = min(text_only)
        return made((name, hx), (None, _norm(bg_hex)), "text")

    # 2. recolour the background only
    bg_only = [
        (delta_e(rgb, bg_rgb), i, name, hx)
        for i, (name, hx, rgb) in enumerate(colours)
        if contrast_ratio(text_rgb, rgb) >= required
    ]
    if bg_only:
        _, _, name, hx = min(bg_only)
        return made((None, _norm(text_hex)), (name, hx), "background")

    # 3. recolour both
    pairs = [
        (delta_e(t_rgb, text_rgb) + delta_e(b_rgb, bg_rgb), i, j, t_name, t_hex, b_name, b_hex)
        for i, (t_name, t_hex, t_rgb) in enumerate(colours)
        for j, (b_name, b_hex, b_rgb) in enumerate(colours)
        if i != j and contrast_ratio(t_rgb, b_rgb) >= required
    ]
    if pairs:
        _, _, _, t_name, t_hex, b_name, b_hex = min(pairs)
        return made((t_name, t_hex), (b_name, b_hex), "both")
    return None
