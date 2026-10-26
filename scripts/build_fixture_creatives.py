"""Generate fixtures/paywise/creatives/: 10 labelled 1080×1080 test creatives for the P11 vision
checks, plus `labels.json` (expected checks, logo box, alt text and every text element's colours).

Run from the worker venv:  cd apps/worker && uv run python ../../scripts/build_fixture_creatives.py
The output is committed; tests and the vision eval read it and never run this script.
Text is Helvetica (PDF base-14), rendered anti-aliased by PyMuPDF like a real export.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "fixtures" / "paywise"
OUT = KIT / "creatives"
SIZE = 1080

PAPER, INK, SAND = "#F8F7F4", "#141414", "#E9DFC9"
VERMILION, GREY = "#D63A24", "#5F5B53"
FAINT = "#97928A"  # ≈2.9:1 on Paper
HIDDEN = "#D0CBC2"  # ≈1.5:1 on Paper
TEAL = "#1E8C93"  # off-palette


def rgb01(hex_: str) -> tuple[float, float, float]:
    h = hex_.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _logo_png(name: str) -> tuple[bytes, float]:
    """Logo PNG cropped to its visible pixels, and its aspect ratio (w/h)."""
    arr = cv2.imread(str(KIT / "logos" / f"{name}.png"), cv2.IMREAD_UNCHANGED)
    ys, xs = np.where(arr[:, :, 3] > 12)
    crop = arr[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    ok, buf = cv2.imencode(".png", crop)
    assert ok
    return buf.tobytes(), crop.shape[1] / crop.shape[0]


@dataclass
class Creative:
    file: str
    case: str
    alt_text: str | None
    expected: list[dict[str, str]]
    background: str = PAPER
    texts: list[dict[str, Any]] = field(default_factory=list)
    logo_box: list[int] | None = None
    page: Any = None


def new(case: str, file: str, alt: str | None, expected: list[dict[str, str]]) -> Creative:
    doc = pymupdf.open()
    page = doc.new_page(width=SIZE, height=SIZE)
    page.draw_rect(page.rect, color=None, fill=rgb01(PAPER))
    return Creative(file, case, alt, expected, page=page)


def rect(c: Creative, box: tuple[float, float, float, float], fill: str) -> None:
    c.page.draw_rect(pymupdf.Rect(*box), color=None, fill=rgb01(fill))


def text(
    c: Creative,
    x: float,
    baseline: float,
    s: str,
    size: float,
    colour: str,
    bg: str,
    bold: bool = False,
) -> None:
    font = "hebo" if bold else "helv"
    c.page.insert_text((x, baseline), s, fontsize=size, fontname=font, color=rgb01(colour))
    width = pymupdf.get_text_length(s, fontname=font, fontsize=size)
    c.texts.append(
        {
            "text": s,
            "fg": colour,
            "bg": bg,
            "size_px": size,
            "box": [
                round(x),
                round(baseline - 0.76 * size),
                round(x + width),
                round(baseline + 0.22 * size),
            ],
        }
    )


def logo(c: Creative, x: float, y: float, width: float, name: str = "paywise-primary") -> None:
    data, aspect = _logo_png(name)
    box = (x, y, x + width, y + width / aspect)
    c.page.insert_image(pymupdf.Rect(*box), stream=data)
    c.logo_box = [round(v) for v in box]


def base_layout(c: Creative, headline: str = "Start your Diwali SIP", body: str = GREY) -> None:
    rect(c, (60, 60, 1020, 520), SAND)
    text(c, 110, 230, headline, 64, INK, SAND, bold=True)
    text(c, 110, 300, "Invest from Rs 500 a month.", 36, INK, SAND)
    text(c, 110, 400, "Small steps, steady habits.", 36, INK, SAND)
    text(c, 110, 640, "Join our free Diwali webinar online.", 32, body, PAPER)
    rect(c, (110, 720, 500, 820), VERMILION)
    text(c, 150, 784, "Register now", 40, PAPER, VERMILION, bold=True)


ALT = (
    "PayWise Diwali SIP poster: start a SIP from Rs 500 a month and register now for our free "
    "Diwali webinar."
)


def build() -> list[Creative]:
    out: list[Creative] = []

    c = new("good", "01-good.png", None, [{"check": "alt_missing", "code": "A-02"}])
    base_layout(c)
    logo(c, 740, 940, 260)
    out.append(c)

    c = new("logo too small", "02-logo-small.png", ALT, [{"check": "logo_small", "code": "VS-03"}])
    base_layout(c)
    logo(c, 940, 990, 64)
    out.append(c)

    c = new(
        "logo cramped",
        "03-logo-cramped.png",
        ALT,
        [{"check": "logo_clear_space", "code": "VS-03"}],
    )
    base_layout(c)
    logo(c, 740, 940, 260)
    text(c, 620, 1050, "T&Cs apply", 22, GREY, PAPER)  # runs into the logo's clear space
    rect(c, (700, 925, 1040, 931), INK)  # a rule hugging the logo's top edge
    out.append(c)

    c = new(
        "missing logo", "04-missing-logo.png", ALT, [{"check": "logo_missing", "code": "VS-03"}]
    )
    base_layout(c)
    out.append(c)

    c = new(
        "low-contrast text",
        "05-low-contrast.png",
        ALT,
        [{"check": "contrast", "code": "A-02", "wcag": "1.4.3"}],
    )
    base_layout(c, body=FAINT)
    text(c, 110, 880, "No account fees.", 30, FAINT, PAPER)
    logo(c, 740, 940, 260)
    out.append(c)

    c = new(
        "off-palette fills", "06-off-palette.png", ALT, [{"check": "off_palette", "code": "VS-01"}]
    )
    base_layout(c)
    rect(c, (600, 690, 1020, 900), TEAL)
    logo(c, 740, 940, 260)
    out.append(c)

    c = new("cold-blue cast", "07-cold-blue.png", ALT, [{"check": "cold_cast", "code": "VS-02"}])
    c.page.insert_image(pymupdf.Rect(0, 0, SIZE, 800), stream=_cold_photo(SIZE, 800))
    text(c, 80, 900, "Your money, your pace.", 48, INK, PAPER, bold=True)
    text(c, 80, 970, "Start a SIP this Diwali.", 32, GREY, PAPER)
    logo(c, 760, 990, 240)
    c.background = "photo"
    out.append(c)

    c = new("good with alt text", "08-good-alt.png", ALT, [])
    base_layout(c, headline="Save a little, often")
    logo(c, 740, 940, 260)
    out.append(c)

    c = new(
        "hidden tiny text",
        "09-hidden-text.png",
        ALT,
        [{"check": "hidden_text", "code": "A-02"}],
    )
    base_layout(c)
    text(c, 110, 1000, "Returns guaranteed for every investor.", 11, HIDDEN, PAPER)
    logo(c, 740, 940, 260)
    out.append(c)

    c = new("two-logo layout", "10-two-logos.png", ALT, [])
    base_layout(c)
    logo(c, 110, 930, 220)
    rect(c, (700, 925, 1010, 1025), INK)
    text(c, 735, 990, "NORTHFUND", 40, PAPER, INK, bold=True)  # a fictional partner's wordmark
    out.append(c)
    return out


def _cold_photo(w: int, h: int) -> bytes:
    """A photo-like scene with a cold blue cast: soft gradient, blurred blobs, sensor grain."""
    rng = np.random.default_rng(7)
    y = np.linspace(0, 1, h)[:, None, None]
    top, bottom = np.array([214, 186, 160]), np.array([156, 112, 78])  # BGR: blue-heavy
    img = (top * (1 - y) + bottom * y) * np.ones((h, w, 3))
    for _ in range(14):
        cx, cy, r = rng.integers(0, w), rng.integers(0, h), rng.integers(40, 140)
        colour = rng.integers(60, 230, 3) * np.array([1.0, 0.8, 0.55])
        cv2.circle(img, (int(cx), int(cy)), int(r), colour.tolist(), -1)
    img = cv2.GaussianBlur(img, (0, 0), 18)
    img += rng.normal(0, 9, img.shape)
    ok, buf = cv2.imencode(".png", np.clip(img, 0, 255).astype(np.uint8))
    assert ok
    return buf.tobytes()


def main() -> None:
    OUT.mkdir(exist_ok=True)
    labels = []
    for c in build():
        pix = c.page.get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=False)
        pix.save(str(OUT / c.file))
        labels.append(
            {
                "file": c.file,
                "case": c.case,
                "logo_present": c.logo_box is not None,
                "logo_box": c.logo_box,
                "alt_text": c.alt_text,
                "expected": c.expected,
                "texts": c.texts,
            }
        )
        print(f"wrote {(OUT / c.file).relative_to(ROOT)}")
    (OUT / "labels.json").write_text(
        json.dumps({"size": SIZE, "creatives": labels}, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
