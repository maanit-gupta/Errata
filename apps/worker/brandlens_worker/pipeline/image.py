"""Images through the pipeline (P11): stage 1 builds a Doc from OCR (so every text filter runs on
the words in the picture) and stage 3 adds the deterministic image checks: logo presence, size and
clear space (VS-03), WCAG contrast and hidden fine print (A-02, 1.4.3), off-palette fills (VS-01)
and missing alt text (A-02, 1.1.1). The warmth heuristic pre-filters the vision LLM's VS-02 check.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from brandlens_worker import config
from brandlens_worker.pipeline.filters.base import cap_severity
from brandlens_worker.pipeline.types import Doc, Finding, Rule, Segment, Vault
from brandlens_worker.vision import RGB, Box, decode_image, encode_png, overlap_fraction
from brandlens_worker.vision.colour import PaletteColour, Warmth, dominant_fills, warmth
from brandlens_worker.vision.contrast import TextContrast, measure_text_contrast, rgb_to_hex
from brandlens_worker.vision.logo import LogoMatch, LogoTemplate, clear_space, detect_logo
from brandlens_worker.vision.ocr import OcrLine, ocr


@dataclass(frozen=True)
class VisualKit:
    """The org's visual assets (SPEC §3 `assets`): logo templates and the palette."""

    logos: list[LogoTemplate] = field(default_factory=list)
    palette: list[PaletteColour] = field(default_factory=list)
    max_delta_e: float = config.DELTA_E_MAX_DEFAULT
    min_logo_width_px: int = config.LOGO_MIN_WIDTH_DEFAULT
    clear_space_ratio: float = config.CLEAR_SPACE_RATIO_DEFAULT


@dataclass
class ImageAnalysis:
    rgb: RGB
    lines: list[OcrLine]  # text lines, excluding the logo's own lettering
    contrasts: list[TextContrast | None]  # parallel to `lines`
    logo: LogoMatch | None
    warmth: Warmth
    ocr_engine: str
    lossy: bool = False  # JPEG: contrast of small coloured text is an estimate

    @property
    def size(self) -> tuple[int, int]:
        return self.rgb.shape[1], self.rgb.shape[0]

    @property
    def whole(self) -> Box:
        w, h = self.size
        return (0, 0, w, h)


def analyse_image(data: bytes, kit: VisualKit, *, ocr_engine: str = "tesseract") -> ImageAnalysis:
    rgb = decode_image(data)
    logo = (
        detect_logo(rgb, kit.logos, min_inliers=config.LOGO_MIN_GOOD_MATCHES) if kit.logos else None
    )
    all_lines, engine = ocr(rgb, ocr_engine)
    # The logo's own lettering is approved artwork, not copy.
    lines = [ln for ln in all_lines if not (logo and overlap_fraction(ln.box, logo.box) > 0.5)]
    contrasts = [
        measure_text_contrast(rgb, ln.box, large_text_px=config.LARGE_TEXT_PX) for ln in lines
    ]
    exclude = [ln.box for ln in all_lines] + ([logo.box] if logo else [])
    heat = warmth(rgb, exclude, cool_below=config.WARMTH_COOL_B)
    return ImageAnalysis(rgb, lines, contrasts, logo, heat, engine, data[:3] == b"\xff\xd8\xff")


def image_doc(analysis: ImageAnalysis, data: bytes) -> Doc:
    """OCR lines → Doc text (one line per row); every word is a Segment with its pixel box."""
    parts: list[str] = []
    segments: list[Segment] = []
    pos = 0
    for i, line in enumerate(analysis.lines):
        if i:
            parts.append("\n")
            pos += 1
        for j, word in enumerate(line.words):
            if j:
                parts.append(" ")
                pos += 1
            parts.append(word.text)
            segments.append(Segment(word.text, pos, pos + len(word.text), bbox=word.box))
            pos += len(word.text)
    text = "".join(parts)
    return Doc(
        text=text, original=text, char_map=list(range(len(text))), segments=segments, images=[data]
    )


def _rule(vault: Vault, dimension: str, *keywords: str) -> Rule | None:
    """The approved rule of `dimension` whose title/body mentions a keyword; None if none does.
    (Stricter than `pick_rule`: an image finding must never cite an unrelated rule.)"""
    for rule in sorted(vault.rules_for(dimension), key=lambda r: r.code):
        haystack = f"{rule.title}\n{rule.body}".lower()
        if any(k in haystack for k in keywords):
            return rule
    return None


def logo_rule(vault: Vault) -> Rule | None:
    return _rule(vault, "visual", "logo", "wordmark")


def palette_rule(vault: Vault) -> Rule | None:
    return _rule(vault, "visual", "palette")


def text_image_rule(vault: Vault) -> Rule | None:
    return _rule(vault, "access", "contrast", "alternative text", "alt text")


def _visual(rule: Rule, quote: str, box: Box, explanation: str, **kw: object) -> Finding:
    return Finding(
        dimension=rule.dimension,
        start=0,
        end=0,
        severity=cap_severity(rule.dimension, rule.severity),
        explanation=explanation,
        rule_id=rule.id,
        codes=[rule.code],
        target="image",
        bbox=box,
        quote=quote,
        **kw,  # type: ignore[arg-type]
    )


def _line_span(doc: Doc, analysis: ImageAnalysis, index: int) -> tuple[int, int]:
    """Text offsets of OCR line `index` in the Doc built by `image_doc`."""
    start = sum(len(ln.text) + 1 for ln in analysis.lines[:index])
    return start, start + len(analysis.lines[index].text)


def check_image(
    analysis: ImageAnalysis, doc: Doc, kit: VisualKit, vault: Vault, alt_text: str | None
) -> list[Finding]:
    out: list[Finding] = []

    # VS-03: logo present, wide enough, with clear space.
    rule = logo_rule(vault)
    if rule and kit.logos:
        logo = analysis.logo
        if logo is None:
            out.append(
                _visual(
                    rule,
                    "No PayWise logo found",
                    analysis.whole,
                    "Every creative must carry the logo; none was found in this image.",
                )
            )
        else:
            if logo.width < kit.min_logo_width_px:
                out.append(
                    _visual(
                        rule,
                        f"Logo, {logo.width} px wide",
                        logo.box,
                        f"The logo is {logo.width} px wide; the minimum is "
                        f"{kit.min_logo_width_px} px.",
                    )
                )
            space = clear_space(
                analysis.rgb,
                logo.box,
                ratio=kit.clear_space_ratio,
                variance_max=config.CLEAR_SPACE_VARIANCE_MAX,
            )
            if not space.ok:
                out.append(
                    _visual(
                        rule,
                        "Logo clear space",
                        space.ring,
                        f"Something sits inside the logo's clear space (the "
                        f"{kit.clear_space_ratio:g}× logo-height margin on every side). Move it "
                        "out or shrink it.",
                    )
                )

    # A-02 / WCAG 1.4.3: contrast of every text line; tiny or faint lines are hidden fine print.
    access = text_image_rule(vault)
    for i, (line, tc) in enumerate(zip(analysis.lines, analysis.contrasts, strict=True)):
        if tc is None:
            continue
        start, end = _line_span(doc, analysis, i)
        hidden = line.height < config.TINY_TEXT_PX or tc.ratio < config.FAINT_TEXT_RATIO
        ratio = f"{tc.ratio:.2f} : 1 ({rgb_to_hex(tc.glyph)} on {rgb_to_hex(tc.background)})"
        if hidden:
            explanation = (
                f"This text is {line.height} px high at {ratio}: fine print this small or faint "
                "is effectively hidden. Make it readable or remove it."
            )
        elif not tc.passes:
            explanation = (
                f"Contrast is {ratio}; {'large' if tc.large else 'normal'} text needs at least "
                f"{tc.required:g} : 1."
            )
        else:
            continue
        if analysis.lossy:
            explanation += " (Measured on a JPEG, so treat the ratio as an estimate.)"
        out.append(
            Finding(
                dimension="access",
                start=start,
                end=end,
                severity=cap_severity("access", "warning"),
                explanation=explanation,
                rule_id=access.id if access else None,
                wcag_ref="1.4.3" if not tc.passes else None,
                codes=([access.code] if access else []) + ([] if tc.passes else ["WCAG 1.4.3"]),
                bbox=line.box,
            )
        )

    # VS-01: flat fills off the palette.
    rule = palette_rule(vault)
    if rule and kit.palette:
        exclude = [ln.box for ln in analysis.lines] + ([analysis.logo.box] if analysis.logo else [])
        for fill in dominant_fills(analysis.rgb, kit.palette, exclude):
            if fill.delta_e > kit.max_delta_e:
                out.append(
                    _visual(
                        rule,
                        f"Fill {fill.hex}",
                        fill.box,
                        f"{fill.hex} is ΔE {fill.delta_e:.1f} from the nearest palette colour "
                        f"({fill.nearest.name} {fill.nearest.hex}); the limit is "
                        f"{kit.max_delta_e:g}.",
                    )
                )

    # A-02 / WCAG 1.1.1: an image needs alt text. (Its quality is the vision LLM's job.)
    if not (alt_text or "").strip():
        out.append(
            Finding(
                dimension="access",
                start=0,
                end=0,
                severity=cap_severity("access", "warning"),
                explanation="This image has no alt text. Describe what it says and its call to "
                "action, so screen-reader users get the same message.",
                rule_id=access.id if access else None,
                wcag_ref="1.1.1",
                codes=([access.code] if access else []) + ["WCAG 1.1.1"],
                target="image",
                bbox=analysis.whole,
                quote="(no alt text)",
            )
        )
    return [f for f in out if f.cited]


def llm_image(analysis: ImageAnalysis, doc: Doc, redacted_spans: list[tuple[int, int]]) -> bytes:
    """The LLM-bound copy: anything the redactor caught is blacked out, then downscaled."""
    img = analysis.rgb.copy()
    for start, end in redacted_spans:
        box = doc.bbox_for(start, end)
        if box:
            x0, y0, x1, y1 = box
            img[max(0, y0 - 2) : y1 + 2, max(0, x0 - 2) : x1 + 2] = 0
    h, w = img.shape[:2]
    scale = config.VISION_MAX_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return encode_png(np.ascontiguousarray(img))
