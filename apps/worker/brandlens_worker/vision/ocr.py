"""OCR with word boxes. PaddleOCR when installed and selected (lazy import: it is heavy), else
Tesseract. Paddle failing to import, erroring or running out of memory falls back to Tesseract.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from brandlens_worker.vision import RGB, Box, overlap_fraction, union

log = logging.getLogger(__name__)

UPSCALE = 2.0  # small text OCRs far better upscaled
MIN_CONFIDENCE = 45.0
MIN_WORD_PX = 6  # shorter 'words' are image grain
DARK_GRAY = 128  # flat regions darker than this get an inverted OCR pass
BINARY_DIFF = 14  # grey levels from the local background that count as ink in the second pass


@dataclass(frozen=True)
class OcrWord:
    text: str
    box: Box
    confidence: float


@dataclass
class OcrLine:
    words: list[OcrWord] = field(default_factory=list)

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)

    @property
    def box(self) -> Box:
        return union([w.box for w in self.words])

    @property
    def height(self) -> int:
        # Median word height: robust to one tall glyph or a descender-only word.
        return int(np.median([w.box[3] - w.box[1] for w in self.words]))


def ocr(img: RGB, engine: str = "tesseract") -> tuple[list[OcrLine], str]:
    """Return text lines (reading order) and the engine that actually ran."""
    if engine == "paddle":
        try:
            return _paddle(img), "paddle"
        except Exception as exc:  # ImportError, MemoryError, model download failures…
            log.warning(
                "paddleocr unavailable; using tesseract", extra={"error": type(exc).__name__}
            )
    return _tesseract(img), "tesseract"


def _plain(img: RGB) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    out: np.ndarray = cv2.resize(gray, None, fx=UPSCALE, fy=UPSCALE, interpolation=cv2.INTER_CUBIC)
    return out


def _binarised(img: RGB) -> np.ndarray:
    """Black wherever a pixel differs from its local (median) background, white elsewhere.

    Polarity-agnostic, so light text on a coloured button and faint fine print both come out as
    black-on-white. It hollows thick strokes of big headlines, which the plain pass reads instead.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    diff = cv2.absdiff(gray, cv2.medianBlur(gray, 41))
    big = cv2.resize(diff, None, fx=UPSCALE, fy=UPSCALE, interpolation=cv2.INTER_CUBIC)
    out: np.ndarray = np.where(big > BINARY_DIFF, 0, 255).astype(np.uint8)
    return out


def _tesseract_words(prepared: np.ndarray, offset: tuple[int, int] = (0, 0)) -> list[OcrWord]:
    import pytesseract  # type: ignore[import-untyped]

    data: dict[str, list[Any]] = pytesseract.image_to_data(
        prepared, config="--psm 11", output_type=pytesseract.Output.DICT
    )
    words = []
    ox, oy = offset
    for i, raw in enumerate(data["text"]):
        text = str(raw).strip()
        conf = float(data["conf"][i])
        if not text or conf < MIN_CONFIDENCE or not any(c.isalnum() for c in text):
            continue
        if data["height"][i] / UPSCALE < MIN_WORD_PX:
            continue
        x, y = ox + data["left"][i] / UPSCALE, oy + data["top"][i] / UPSCALE
        w, h = data["width"][i] / UPSCALE, data["height"][i] / UPSCALE
        words.append(
            OcrWord(text, (int(x), int(y), int(np.ceil(x + w)), int(np.ceil(y + h))), conf)
        )
    return words


def dark_regions(img: RGB) -> list[Box]:
    """Flat dark areas (buttons, Ink panels, a dark page): where light-on-dark text lives."""
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    f = gray.astype(np.float32)
    std = np.sqrt(np.maximum(cv2.blur(f * f, (5, 5)) - cv2.blur(f, (5, 5)) ** 2, 0))
    flat_dark = ((gray < DARK_GRAY) & (std < 4)).astype(np.uint8)
    # Close over the glyphs so a button and its label form one region.
    closed = cv2.morphologyEx(flat_dark, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    n, _labels, stats, _ = cv2.connectedComponentsWithStats(closed, 8)
    boxes = []
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in stats[i])
        # Mostly genuinely flat (a fill), not grain in a photo that closing glued together.
        if area >= 1500 and w >= 24 and h >= 16 and flat_dark[y : y + h, x : x + w].mean() > 0.6:
            boxes.append((x, y, x + w, y + h))
    return boxes


def _inverted_crop(img: RGB, box: Box) -> np.ndarray:
    x0, y0, x1, y1 = box
    gray = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
    big: np.ndarray = cv2.resize(
        255 - gray, None, fx=UPSCALE, fy=UPSCALE, interpolation=cv2.INTER_CUBIC
    )
    return big


def _tesseract(img: RGB) -> list[OcrLine]:
    """Three passes, each adding only words that don't overlap earlier ones:
    1. plain greyscale: clean on photos and big type;
    2. each flat dark region, inverted: light text on buttons and Ink panels;
    3. the binarised page: faint fine print."""
    words = _tesseract_words(_plain(img))

    def add(more: list[OcrWord]) -> None:
        words.extend(
            w for w in more if not any(overlap_fraction(w.box, o.box) > 0.3 for o in words)
        )

    for box in dark_regions(img):
        add(_tesseract_words(_inverted_crop(img, box), offset=(box[0], box[1])))
    add(_tesseract_words(_binarised(img)))
    return group_lines(words)


def group_lines(words: list[OcrWord]) -> list[OcrLine]:
    """Group words into lines: same row (vertical centres within half a word height, similar
    heights), then split each row where the horizontal gap exceeds 1.2× the word height.
    Lines come out top-to-bottom, left-to-right."""
    rows: list[list[OcrWord]] = []
    for w in sorted(words, key=lambda w: (w.box[1] + w.box[3]) / 2):
        wh = w.box[3] - w.box[1]
        wc = (w.box[1] + w.box[3]) / 2
        for row in rows:
            rh = float(np.median([r.box[3] - r.box[1] for r in row]))
            rc = float(np.median([(r.box[1] + r.box[3]) / 2 for r in row]))
            if abs(wc - rc) < 0.5 * min(wh, rh) and 0.5 < wh / max(1.0, rh) < 2.0:
                row.append(w)
                break
        else:
            rows.append([w])
    lines: list[OcrLine] = []
    for row in rows:
        row.sort(key=lambda w: w.box[0])
        current = OcrLine([row[0]])
        for w in row[1:]:
            prev = current.words[-1]
            gap = w.box[0] - prev.box[2]
            if gap > 1.2 * max(w.box[3] - w.box[1], prev.box[3] - prev.box[1]):
                lines.append(current)
                current = OcrLine([w])
            else:
                current.words.append(w)
        lines.append(current)
    return sorted(lines, key=lambda line: (line.box[1] // 8, line.box[0]))


def _paddle(img: RGB) -> list[OcrLine]:  # pragma: no cover - optional extra
    from paddleocr import PaddleOCR

    engine = _paddle_engine(PaddleOCR)
    result = engine.ocr(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    lines = []
    for item in result[0] or []:
        quad, (text, conf) = item
        xs, ys = [p[0] for p in quad], [p[1] for p in quad]
        if text.strip() and conf * 100 >= MIN_CONFIDENCE:
            box = (int(min(xs)), int(min(ys)), int(np.ceil(max(xs))), int(np.ceil(max(ys))))
            lines.append(OcrLine([OcrWord(text.strip(), box, conf * 100)]))
    return sorted(lines, key=lambda line: (line.box[1] // 8, line.box[0]))


_PADDLE: Any = None


def _paddle_engine(cls: Any) -> Any:  # pragma: no cover - optional extra
    global _PADDLE
    if _PADDLE is None:
        _PADDLE = cls(lang="en", show_log=False)
    return _PADDLE
