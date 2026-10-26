"""Logo detection: ORB features + RANSAC homography, with multi-scale `matchTemplate` as a second
opinion: it confirms an ORB hit (correlation at that box) and finds logos too small to carry
enough features. Plus the clear-space check (VS-03).
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt

from brandlens_worker.vision import RGB, Box

GRAY = npt.NDArray[np.uint8]

ORB_TEMPLATE_WIDTH = 240  # templates are normalised to this width before ORB
TM_MIN_WIDTH = 40
TM_SCALE_STEP = 1.08
TM_MIN_SCORE = 0.72  # TM_CCOEFF_NORMED; tuned on fixtures/paywise/creatives


@dataclass(frozen=True)
class LogoTemplate:
    name: str
    gray: GRAY  # tightly cropped to the logo's visible pixels


@dataclass(frozen=True)
class LogoMatch:
    template: str
    box: Box
    method: str  # "orb" | "template"
    score: float  # ORB: inlier count; template: correlation
    inliers: int
    correlation: float

    @property
    def width(self) -> int:
        return self.box[2] - self.box[0]

    @property
    def height(self) -> int:
        return self.box[3] - self.box[1]


def load_template(name: str, data: bytes) -> LogoTemplate:
    """Decode a logo file, flatten transparency onto the background it is designed for (its own
    dominant opaque luminance decides: dark wordmarks sit on Paper, light ones on Ink) and crop."""
    arr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if arr is None:
        raise ValueError(f"logo {name}: not a decodable image")
    if arr.ndim == 2:
        arr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGRA)
    if arr.shape[2] == 3:
        arr = cv2.cvtColor(arr, cv2.COLOR_BGR2BGRA)
    alpha = arr[:, :, 3].astype(np.float32) / 255.0
    gray = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_BGR2GRAY).astype(np.float32)
    opaque = alpha > 0.5
    if not opaque.any():
        raise ValueError(f"logo {name}: fully transparent")
    # Light marks (reversed logos) are designed for Ink; dark ones for Paper.
    bg = 20.0 if np.median(gray[opaque]) > 140 else 247.0
    flat = (gray * alpha + bg * (1 - alpha)).astype(np.uint8)
    ys, xs = np.where(alpha > 0.05)
    crop = flat[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    return LogoTemplate(name, crop)


def _gray(img: RGB) -> GRAY:
    out: GRAY = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return out


def _resize_to_width(gray: GRAY, width: int) -> GRAY:
    h, w = gray.shape
    out: GRAY = cv2.resize(
        gray, (width, max(1, round(h * width / w))), interpolation=cv2.INTER_AREA
    )
    return out


def _orb_match(img_gray: GRAY, tpl: LogoTemplate, min_inliers: int) -> LogoMatch | None:
    orb = cv2.ORB.create(
        nfeatures=4000, scaleFactor=1.2, nlevels=10, edgeThreshold=11, patchSize=21
    )
    t = _resize_to_width(tpl.gray, ORB_TEMPLATE_WIDTH)
    kt, dt = orb.detectAndCompute(t, None)
    ki, di = orb.detectAndCompute(img_gray, None)
    if dt is None or di is None or len(kt) < 4 or len(ki) < 4:
        return None
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(dt, di, k=2)
    good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    if len(good) < max(4, min_inliers):
        return None
    src = np.array([kt[m.queryIdx].pt for m in good], np.float32).reshape(-1, 1, 2)
    dst = np.array([ki[m.trainIdx].pt for m in good], np.float32).reshape(-1, 1, 2)
    hmat, inlier_mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
    if hmat is None:
        return None
    inliers = int(inlier_mask.sum())
    if inliers < min_inliers:
        return None
    th, tw = t.shape
    corners = np.array([[0, 0], [tw, 0], [tw, th], [0, th]], np.float32).reshape(-1, 1, 2)
    quad = cv2.perspectiveTransform(corners, hmat).reshape(-1, 2)
    x0, y0 = quad.min(axis=0)
    x1, y1 = quad.max(axis=0)
    bw, bh = x1 - x0, y1 - y0
    # Reject degenerate or distorted homographies (aspect ratio far from the template's).
    if bw < 8 or bh < 4 or not 0.75 < (bw / bh) / (tw / th) < 1.33:
        return None
    h, w = img_gray.shape
    box = (max(0, int(x0)), max(0, int(y0)), min(w, int(np.ceil(x1))), min(h, int(np.ceil(y1))))
    return LogoMatch(tpl.name, box, "orb", float(inliers), inliers, 0.0)


def _correlation_at(img_gray: GRAY, tpl: LogoTemplate, box: Box) -> float:
    """Template correlation in a small window around a known box (the ORB result)."""
    x0, y0, x1, _y1 = box
    t = _resize_to_width(tpl.gray, max(8, x1 - x0))
    th, tw = t.shape
    pad = max(4, th // 4)
    h, w = img_gray.shape
    window = img_gray[
        max(0, y0 - pad) : min(h, y0 + th + pad), max(0, x0 - pad) : min(w, x0 + tw + pad)
    ]
    if window.shape[0] < th or window.shape[1] < tw:
        return 0.0
    return float(cv2.matchTemplate(window, t, cv2.TM_CCOEFF_NORMED).max())


def _template_match(img_gray: GRAY, tpl: LogoTemplate) -> LogoMatch | None:
    """Multi-scale search on a half-resolution copy, then one refinement step at full size."""
    h, w = img_gray.shape
    half: GRAY = cv2.resize(img_gray, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    th0, tw0 = tpl.gray.shape
    best: tuple[float, int, int, int] | None = None  # score, x, y, width (half-res)
    width = TM_MIN_WIDTH / 2
    max_width = min(w, tw0 * h / th0) * 0.45
    while width <= max_width:
        t = _resize_to_width(tpl.gray, round(width))
        th, tw = t.shape
        if th >= half.shape[0] or tw >= half.shape[1] or th < 4:
            break
        res = cv2.matchTemplate(half, t, cv2.TM_CCOEFF_NORMED)
        _mn, score, _ml, (x, y) = cv2.minMaxLoc(res)
        if best is None or score > best[0]:
            best = (float(score), x, y, tw)
        width *= TM_SCALE_STEP
    if best is None:
        return None
    # Refine at full resolution around the coarse hit, across neighbouring scales.
    _s, hx, hy, hw = best
    top: tuple[float, Box] | None = None
    for f in (0.94, 0.97, 1.0, 1.03, 1.06):
        t = _resize_to_width(tpl.gray, max(8, round(hw * 2 * f)))
        th, tw = t.shape
        pad = max(6, th // 3)
        x0, y0 = max(0, hx * 2 - pad), max(0, hy * 2 - pad)
        window = img_gray[y0 : min(h, hy * 2 + th + pad), x0 : min(w, hx * 2 + tw + pad)]
        if window.shape[0] < th or window.shape[1] < tw:
            continue
        res = cv2.matchTemplate(window, t, cv2.TM_CCOEFF_NORMED)
        _mn, score, _ml, (x, y) = cv2.minMaxLoc(res)
        if top is None or score > top[0]:
            top = (float(score), (x0 + x, y0 + y, x0 + x + tw, y0 + y + th))
    if top is None or top[0] < TM_MIN_SCORE:
        return None
    return LogoMatch(tpl.name, top[1], "template", top[0], 0, top[0])


def detect_logo(img: RGB, templates: list[LogoTemplate], *, min_inliers: int) -> LogoMatch | None:
    """The best match over all templates. ORB wins when it has enough inliers (its box follows the
    homography); otherwise the strongest template correlation above TM_MIN_SCORE."""
    gray = _gray(img)
    orb = [m for t in templates if (m := _orb_match(gray, t, min_inliers))]
    if orb:
        best = max(orb, key=lambda m: m.inliers)
        tpl = next(t for t in templates if t.name == best.template)
        corr = _correlation_at(gray, tpl, best.box)
        return LogoMatch(best.template, best.box, "orb", best.score, best.inliers, corr)
    # Too small (or too few features) for ORB: the template search is the second opinion.
    tm = [m for t in templates if (m := _template_match(gray, t))]
    return max(tm, key=lambda m: m.correlation, default=None)


@dataclass(frozen=True)
class ClearSpace:
    variance: float
    ring: Box  # outer edge of the checked ring
    ok: bool


def clear_space(img: RGB, logo: Box, *, ratio: float, variance_max: float) -> ClearSpace:
    """Grey-level variance in the ring from just outside the logo to `ratio`× its height away.
    A clean ring (one flat background) has near-zero variance; text or shapes intruding raise it."""
    gray = _gray(img).astype(np.float64)
    h, w = gray.shape
    x0, y0, x1, y1 = logo
    lh = y1 - y0
    inset = max(2, round(lh * 0.04))  # tolerate a slightly loose box
    margin = round(lh * ratio)
    ox0, oy0, ox1, oy1 = (
        max(0, x0 - margin),
        max(0, y0 - margin),
        min(w, x1 + margin),
        min(h, y1 + margin),
    )
    mask = np.zeros((h, w), bool)
    mask[oy0:oy1, ox0:ox1] = True
    mask[max(0, y0 - inset) : y1 + inset, max(0, x0 - inset) : x1 + inset] = False
    pixels = gray[mask]
    variance = float(pixels.var()) if pixels.size else 0.0
    return ClearSpace(variance, (ox0, oy0, ox1, oy1), variance <= variance_max)
