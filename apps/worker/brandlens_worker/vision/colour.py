"""Palette conformance (CIEDE2000 ΔE of flat fills) and the warmth heuristic for VS-02.

Only *flat* regions are clustered: pixels whose 5×5 neighbourhood barely varies. Photographs,
gradients with grain and anti-aliased edges drop out, so the palette check judges fills, shapes
and backgrounds, which is what the brand rule governs. Text and logo boxes are excluded too.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt
from skimage.color import deltaE_ciede2000, rgb2lab

from brandlens_worker.vision import RGB, Box
from brandlens_worker.vision.contrast import hex_to_rgb, rgb_to_hex

FLAT_STD_MAX = 4.0  # per-channel local std (0-255) below which a pixel counts as a flat fill
MIN_FILL_SHARE = 0.03  # clusters smaller than this share of the image are ignored
K = 6


@dataclass(frozen=True)
class PaletteColour:
    name: str
    hex: str


@dataclass(frozen=True)
class Fill:
    rgb: tuple[int, int, int]
    share: float  # of the whole image
    box: Box  # bounding box of the largest connected region of this fill
    nearest: PaletteColour
    delta_e: float

    @property
    def hex(self) -> str:
        return rgb_to_hex(self.rgb)


def lab(rgb: tuple[int, int, int]) -> npt.NDArray[np.float64]:
    out: npt.NDArray[np.float64] = rgb2lab(np.array([[rgb]], dtype=np.uint8))[0, 0]
    return out


def delta_e(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return float(deltaE_ciede2000(lab(a), lab(b)))


def nearest_palette(
    rgb: tuple[int, int, int], palette: list[PaletteColour]
) -> tuple[PaletteColour, float]:
    scored = [(p, delta_e(rgb, hex_to_rgb(p.hex))) for p in palette]
    return min(scored, key=lambda s: s[1])


def exclusion_mask(shape: tuple[int, ...], boxes: list[Box], pad: int = 3) -> npt.NDArray[np.bool_]:
    mask = np.zeros(shape[:2], bool)
    for x0, y0, x1, y1 in boxes:
        mask[max(0, y0 - pad) : y1 + pad, max(0, x0 - pad) : x1 + pad] = True
    return mask


def flat_mask(img: RGB) -> npt.NDArray[np.bool_]:
    f = img.astype(np.float32)
    mean = cv2.blur(f, (5, 5))
    sq = cv2.blur(f * f, (5, 5))
    std = np.sqrt(np.maximum(sq - mean * mean, 0)).max(axis=2)
    out: npt.NDArray[np.bool_] = std < FLAT_STD_MAX
    return out


def dominant_fills(img: RGB, palette: list[PaletteColour], exclude: list[Box]) -> list[Fill]:
    """k-means over flat, non-excluded pixels; every cluster ≥ MIN_FILL_SHARE with its ΔE."""
    if not palette:
        return []
    h, w = img.shape[:2]
    mask = flat_mask(img) & ~exclusion_mask(img.shape, exclude)
    pixels = img[mask]
    if len(pixels) < MIN_FILL_SHARE * h * w:
        return []
    sample = pixels[:: max(1, len(pixels) // 40_000)].astype(np.float32)
    k = min(K, len(np.unique(sample, axis=0)))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
    _c, _l, centres = cv2.kmeans(sample, k, None, criteria, 2, cv2.KMEANS_PP_CENTERS)
    # Assign every flat pixel to its nearest centre.
    d = ((pixels[:, None, :].astype(np.float32) - centres[None]) ** 2).sum(axis=2)
    labels = d.argmin(axis=1)
    label_img = np.full((h, w), -1, np.int32)
    label_img[mask] = labels

    fills = []
    for i in range(k):
        members = labels == i
        share = float(members.sum()) / (h * w)
        if share < MIN_FILL_SHARE:
            continue
        colour = np.median(pixels[members], axis=0)
        rgb = (int(colour[0]), int(colour[1]), int(colour[2]))
        n, _cc, stats, _ = cv2.connectedComponentsWithStats((label_img == i).astype(np.uint8), 8)
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])) if n > 1 else 0
        x, y, bw, bh = (int(v) for v in stats[biggest, :4])
        nearest, de = nearest_palette(rgb, palette)
        fills.append(Fill(rgb, share, (x, y, x + bw, y + bh), nearest, de))
    return sorted(fills, key=lambda f: -f.share)


@dataclass(frozen=True)
class Warmth:
    mean_b: float  # CIELAB b*: negative = blue, positive = yellow
    mean_a: float
    cool: bool


def warmth(img: RGB, exclude: list[Box], *, cool_below: float) -> Warmth:
    """Mean a*/b* of the image outside text and logo boxes; `cool` when b* is clearly blue."""
    small = cv2.resize(img, (max(1, img.shape[1] // 4), max(1, img.shape[0] // 4)))
    mask = ~exclusion_mask(small.shape, [tuple(v // 4 for v in b) for b in exclude], pad=1)  # type: ignore[misc]
    labs = rgb2lab(small)[mask]
    if labs.size == 0:
        return Warmth(0.0, 0.0, False)
    mean_a, mean_b = float(labs[:, 1].mean()), float(labs[:, 2].mean())
    return Warmth(mean_b=mean_b, mean_a=mean_a, cool=mean_b < cool_below)
