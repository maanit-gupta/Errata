"""WCAG 2.2 contrast (1.4.3) for text found in an image.

`relative_luminance` and `contrast_ratio` are the WCAG formulas (the same ones WebAIM's checker
uses). `measure_text_contrast` estimates the glyph and background colours of one text box: the
background is the median of a ring just outside the box, the glyph colour is the median of the
box pixels furthest (in RGB) from that background, which skips anti-aliased edges.

Exact on lossless images. JPEG's 4:2:0 chroma subsampling smears saturated colour across thin
strokes, so on JPEGs small coloured text is an estimate (eval/vision_report.md has the numbers).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from brandlens_worker.vision import RGB, Box


def _channel(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else float(((c + 0.055) / 1.055) ** 2.4)


def relative_luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (_channel(float(v)) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*(round(c) for c in rgb))


@dataclass(frozen=True)
class TextContrast:
    box: Box
    glyph: tuple[int, int, int]
    background: tuple[int, int, int]
    ratio: float
    large: bool

    @property
    def required(self) -> float:
        return 3.0 if self.large else 4.5

    @property
    def passes(self) -> bool:
        # Compare at the precision people read it (WebAIM shows two decimals).
        return round(self.ratio, 2) >= self.required


def measure_text_contrast(img: RGB, box: Box, *, large_text_px: int) -> TextContrast | None:
    """None if the box is degenerate or has no ring (it fills the image)."""
    h_img, w_img = img.shape[:2]
    x0, y0, x1, y1 = (max(0, box[0]), max(0, box[1]), min(w_img, box[2]), min(h_img, box[3]))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    pad = max(2, round((y1 - y0) * 0.2))
    ox0, oy0, ox1, oy1 = (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(w_img, x1 + pad),
        min(h_img, y1 + pad),
    )
    ring_mask = np.ones((oy1 - oy0, ox1 - ox0), bool)
    ring_mask[y0 - oy0 : y1 - oy0, x0 - ox0 : x1 - ox0] = False
    ring = img[oy0:oy1, ox0:ox1][ring_mask]
    if ring.size == 0:
        return None
    background = np.median(ring.reshape(-1, 3), axis=0)

    inner = img[y0:y1, x0:x1].reshape(-1, 3)
    distance = np.linalg.norm(inner.astype(np.float64) - background, axis=1)
    peak = float(np.percentile(distance, 98))
    if peak <= 0:
        return None
    glyph = np.median(inner[distance >= 0.8 * peak], axis=0)
    g = (round(float(glyph[0])), round(float(glyph[1])), round(float(glyph[2])))
    bg = (round(float(background[0])), round(float(background[1])), round(float(background[2])))
    return TextContrast(
        box=(x0, y0, x1, y1),
        glyph=g,
        background=bg,
        ratio=contrast_ratio(g, bg),
        large=(y1 - y0) >= large_text_px,
    )
