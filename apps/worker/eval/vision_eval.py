"""P11 vision eval on fixtures/paywise/creatives → eval/vision_report.md.

    cd apps/worker && uv run python eval/vision_eval.py      (or: make eval-vision)

Records the Round 2 improvement #2 pass test: logo found on ≥ 9 of 10 creatives where it exists,
and contrast ratios within ±0.1 of WebAIM's checker on 20 sampled text/background pairs (WebAIM
implements the WCAG formula, so the reference is that formula on the generator's known colours).
Exits non-zero if either gate fails. Deterministic only: no LLM calls.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

WORKER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKER))

from brandlens_worker import config  # noqa: E402
from brandlens_worker.pipeline.image import analyse_image, check_image, image_doc  # noqa: E402
from brandlens_worker.vision.contrast import contrast_ratio, hex_to_rgb  # noqa: E402
from tests.kit_fixture import CREATIVES, LABELS, kit  # noqa: E402
from tests.test_vision import checks, iou  # noqa: E402
from tests.vault_fixture import paywise_vault  # noqa: E402

REPORT = WORKER / "eval" / "vision_report.md"
PAIRS = 20
TOLERANCE = 0.1


def stress_pairs(jpeg_quality: int | None) -> list[dict[str, Any]]:
    """20 random text/background colour pairs (seeded), 20/28/40 px Helvetica regular and bold,
    rendered like an export; optionally re-encoded as JPEG. Measured through OCR + contrast."""
    import cv2
    import numpy as np
    import pymupdf

    from brandlens_worker.vision import decode_image
    from brandlens_worker.vision.contrast import measure_text_contrast, rgb_to_hex
    from brandlens_worker.vision.ocr import ocr

    rng = np.random.default_rng(11)
    out = []
    for i in range(PAIRS):
        while True:
            fg = tuple(int(v) for v in rng.integers(0, 256, 3))
            bg = tuple(int(v) for v in rng.integers(0, 256, 3))
            ref = contrast_ratio(fg, bg)  # type: ignore[arg-type]
            if 1.8 < ref < 12:
                break
        size = (20, 28, 40)[i % 3]
        doc = pymupdf.open()
        page = doc.new_page(width=640, height=200)
        page.draw_rect(page.rect, color=None, fill=tuple(c / 255 for c in bg))
        page.insert_text(
            (40, 110),
            "Invest a little every month",
            fontsize=size,
            fontname=("helv", "hebo")[i % 2],
            color=tuple(c / 255 for c in fg),
        )
        img = decode_image(page.get_pixmap(alpha=False).tobytes("png"))
        if jpeg_quality:
            bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            _ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
            img = decode_image(buf.tobytes())
        lines, _ = ocr(img)
        line = max(lines, key=lambda ln: len(ln.text), default=None)
        tc = (
            measure_text_contrast(img, line.box, large_text_px=config.LARGE_TEXT_PX)
            if line
            else None
        )
        out.append({"fg": rgb_to_hex(fg), "bg": rgb_to_hex(bg), "size": size, "ref": ref,  # type: ignore[arg-type]
                    "measured": tc.ratio if tc else None})  # fmt: skip
    return out


def stress_rows(pairs: list[dict[str, Any]]) -> list[str]:
    return [
        f"| {i} | {p['fg']} | {p['bg']} | {p['size']} | {p['ref']:.2f} | "
        + (
            f"{p['measured']:.2f} | {abs(p['measured'] - p['ref']):.2f} |"
            if p["measured"]
            else "not read | – |"
        )
        for i, p in enumerate(pairs, 1)
    ]


def within(pairs: list[dict[str, Any]]) -> int:
    return sum(
        p["measured"] is not None and abs(p["measured"] - p["ref"]) <= TOLERANCE for p in pairs
    )


def main() -> int:
    rows_logo: list[str] = []
    rows_checks: list[str] = []
    pairs: list[dict[str, Any]] = []
    found_logos = present = false_logos = 0
    exact_checks = 0
    timings: list[float] = []

    for c in LABELS:
        t = time.perf_counter()
        a = analyse_image((CREATIVES / c["file"]).read_bytes(), kit())
        found = check_image(a, image_doc(a, b""), kit(), paywise_vault(), c["alt_text"])
        timings.append(time.perf_counter() - t)

        logo = a.logo
        if c["logo_present"]:
            present += 1
            found_logos += logo is not None
        elif logo is not None:
            false_logos += 1
        rows_logo.append(
            "| {} | {} | {} | {} | {} | {} | {} |".format(
                c["file"],
                "yes" if c["logo_present"] else "no",
                "yes" if logo else "no",
                logo.method if logo else "–",
                f"{logo.inliers}" if logo and logo.inliers else "–",
                f"{logo.correlation:.2f}" if logo else "–",
                f"{iou(logo.box, c['logo_box']):.2f}" if logo and c["logo_box"] else "–",
            )
        )

        expected = {e["check"] for e in c["expected"]}
        got = checks(found) | ({"cold_cast"} if a.warmth.cool else set())
        exact_checks += expected == got
        rows_checks.append(
            f"| {c['file']} | {c['case']} | {', '.join(sorted(expected)) or '–'} | "
            f"{', '.join(sorted(got)) or '–'} | {'✓' if expected == got else '✗'} | "
            f"{a.warmth.mean_b:+.1f} |"
        )

        for text in c["texts"]:
            if text["size_px"] < 16:
                continue
            for line, tc in zip(a.lines, a.contrasts, strict=True):
                if tc and iou(line.box, text["box"]) > 0.3:
                    ref = contrast_ratio(hex_to_rgb(text["fg"]), hex_to_rgb(text["bg"]))
                    pairs.append({"file": c["file"], "text": text["text"], "fg": text["fg"],
                                  "bg": text["bg"], "ref": ref, "measured": tc.ratio,
                                  "glyph": tc.glyph, "background": tc.background})  # fmt: skip
                    break

    # 20 pairs, spread across creatives and colour combinations (distinct fg/bg first).
    seen: set[tuple[str, str, str]] = set()
    sample: list[dict[str, Any]] = []
    for p in sorted(pairs, key=lambda p: (p["fg"], p["bg"], p["file"])):
        key = (p["fg"], p["bg"], p["file"][:2])
        if key not in seen:
            seen.add(key)
            sample.append(p)
    sample = sorted(sample, key=lambda p: (p["file"], p["text"]))
    for p in pairs:
        if len(sample) >= PAIRS:
            break
        if p not in sample:
            sample.append(p)
    sample = sample[:PAIRS]
    worst = max(abs(p["measured"] - p["ref"]) for p in sample)
    in_tol = within(sample)
    png = stress_pairs(None)
    jpg = stress_pairs(85)

    logo_ok = found_logos >= min(9, present) and false_logos == 0
    contrast_ok = len(sample) == PAIRS and in_tol == PAIRS
    stress_ok = within(png) == PAIRS
    lines = [
        "# Vision eval (P11)",
        "",
        "Generated by `make eval-vision` (`apps/worker/eval/vision_eval.py`) on the 10 labelled "
        "creatives in `fixtures/paywise/creatives/` (1080 × 1080, built by "
        "`scripts/build_fixture_creatives.py`). Deterministic checks only; no LLM calls.",
        "",
        "## Gates",
        "",
        "| Gate | Result | Pass |",
        "|---|---|---|",
        f"| Logo found where present (≥ 9 of 10) | {found_logos} of {present} present, "
        f"{false_logos} false positive(s) on {len(LABELS) - present} without | "
        f"{'✓' if logo_ok else '✗'} |",
        f"| Contrast within ±{TOLERANCE} of WebAIM on {PAIRS} creative pairs | {in_tol} of "
        f"{len(sample)} (worst Δ {worst:.3f}) | {'✓' if contrast_ok else '✗'} |",
        f"| Contrast within ±{TOLERANCE} on {PAIRS} random colour pairs (PNG) | {within(png)} of "
        f"{PAIRS} | {'✓' if stress_ok else '✗'} |",
        f"| Same {PAIRS} pairs as JPEG (quality 85, 4:2:0) | {within(jpg)} of {PAIRS} | "
        "known limit |",
        f"| Creatives whose checks exactly match `labels.json` | {exact_checks} of {len(LABELS)} | "
        "info |",
        "",
        f"Mean analysis time per creative (OCR + logo + contrast + palette + warmth): "
        f"{sum(timings) / len(timings):.2f} s (max {max(timings):.2f} s).",
        "",
        "## Logo detection",
        "",
        f"ORB + RANSAC homography first (≥ {config.LOGO_MIN_GOOD_MATCHES} inliers); "
        "multi-scale `matchTemplate` otherwise. Correlation is `TM_CCOEFF_NORMED` at the found "
        "box. IoU is against the generator's logo box.",
        "",
        "| Creative | Logo present | Found | Method | ORB inliers | Correlation | IoU |",
        "|---|---|---|---|---|---|---|",
        *rows_logo,
        "",
        "## Contrast: measured vs WebAIM",
        "",
        "Reference = WCAG 2.2 relative-luminance contrast of the colours the generator drew "
        "(the formula WebAIM's checker uses; spot-checked: #777777 on #FFFFFF = 4.48, #767676 on "
        "#FFFFFF = 4.54). Measured = `vision/contrast.py` on the OCR line box.",
        "",
        "| # | Creative | Text | Foreground | Background | WebAIM | Measured | Δ |",
        "|---|---|---|---|---|---|---|---|",
        *[
            f"| {i} | {p['file']} | {p['text']} | {p['fg']} | {p['bg']} | {p['ref']:.2f} | "
            f"{p['measured']:.2f} | {abs(p['measured'] - p['ref']):.3f} |"
            for i, p in enumerate(sample, 1)
        ],
        "",
        "## Contrast stress: random colour pairs",
        "",
        "The creatives reuse a handful of brand colour pairs on flat backgrounds, so they are the "
        "easy case. These 20 pairs are random (seeded) saturated colours at 20, 28 and 40 px, "
        "regular and bold. As PNG they measure exactly. As JPEG, 4:2:0 chroma subsampling smears "
        "saturated colour across thin strokes, so small coloured text drifts by up to ~1.7: on "
        "JPEG uploads a contrast finding says the ratio is an estimate. Ask for PNG or PDF "
        "sources where contrast matters.",
        "",
        "**PNG**",
        "",
        "| # | Foreground | Background | Size px | WebAIM | Measured | Δ |",
        "|---|---|---|---|---|---|---|",
        *stress_rows(png),
        "",
        "**JPEG, quality 85**",
        "",
        "| # | Foreground | Background | Size px | WebAIM | Measured | Δ |",
        "|---|---|---|---|---|---|---|",
        *stress_rows(jpg),
        "",
        "## Checks per creative",
        "",
        f"`cold_cast` is the warmth pre-filter (mean CIELAB b* < {config.WARMTH_COOL_B}); the "
        "VS-02 finding itself comes from the vision LLM, gated on that signal.",
        "",
        "| Creative | Case | Expected | Found | Match | Mean b* |",
        "|---|---|---|---|---|---|",
        *rows_checks,
        "",
    ]
    REPORT.write_text("\n".join(lines))
    print(f"wrote {REPORT.relative_to(WORKER)}: logo {found_logos}/{present}, contrast "
          f"{in_tol}/{len(sample)} (worst {worst:.3f}), png stress {within(png)}/{PAIRS}, "
          f"jpeg {within(jpg)}/{PAIRS}, checks {exact_checks}/{len(LABELS)}")  # fmt: skip
    return 0 if logo_ok and contrast_ok and stress_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
