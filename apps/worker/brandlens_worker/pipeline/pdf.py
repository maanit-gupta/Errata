"""PDF decks through the pipeline (P12).

Stage 1 reads the text layer with PyMuPDF: every span becomes a Segment with its 1-based page and a
box in *render pixels* (the page thumbnail's pixel space, so the UI overlays boxes without any
scaling metadata beyond the image itself). Pages are processed one at a time and only the PNG
thumbnail is kept, so a 40-page deck never holds 40 decoded bitmaps.

Per page it also measures what needs pixels:
- hidden text (SPEC §6 stage 2): glyph colour ≈ background, < PDF_HIDDEN_PT, fully transparent or
  off the page. It becomes a finding of its own and is redacted from the LLM-bound copy;
- WCAG 1.4.3 contrast of the visible text (declared glyph colour vs the rendered background);
- the logo on the page (size and clear space; a deck page isn't required to carry one);
- embedded pictures: the P11 image checks (OCR + every text filter, contrast, off-palette fills).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from typing import Any, Literal

import numpy as np

from brandlens_worker import config
from brandlens_worker.pipeline.filters import run_filters
from brandlens_worker.pipeline.filters.base import cap_severity
from brandlens_worker.pipeline.image import (
    VisualKit,
    analyse_rgb,
    check_image,
    image_doc,
    logo_rule,
    text_image_rule,
)
from brandlens_worker.pipeline.ingest import IngestError
from brandlens_worker.pipeline.types import Doc, Finding, Redaction, Segment, Vault
from brandlens_worker.vision import RGB, Box, encode_png, overlap_fraction, union
from brandlens_worker.vision.contrast import contrast_ratio, rgb_to_hex, ring_background
from brandlens_worker.vision.logo import LogoMatch, clear_space, detect_logo

HiddenReason = Literal["tiny", "faint", "transparent", "off_page"]
_WS = re.compile(r"\s+")
_BOLD = 1 << 4  # PyMuPDF span flag


@dataclass(frozen=True)
class PdfSpan:
    page: int
    start: int  # offsets in Doc.text
    end: int
    box: Box  # render pixels
    size_pt: float
    colour: tuple[int, int, int]
    background: tuple[int, int, int] | None
    bold: bool
    hidden: HiddenReason | None

    @property
    def ratio(self) -> float | None:
        return contrast_ratio(self.colour, self.background) if self.background else None

    @property
    def large(self) -> bool:  # WCAG: ≥ 18 pt, or ≥ 14 pt bold
        return self.size_pt >= 18 or (self.bold and self.size_pt >= 14)


@dataclass(frozen=True)
class HiddenText:
    page: int
    start: int
    end: int
    box: Box
    reason: HiddenReason
    detail: str


@dataclass(frozen=True)
class PdfLink:
    page: int
    start: int  # the link's visible text in Doc.text
    end: int
    box: Box
    uri: str | None


@dataclass
class PdfPage:
    n: int  # 1-based
    width: int  # render px
    height: int
    zoom: float  # render px per PDF point
    png: bytes
    start: int  # this page's text range in Doc.text
    end: int
    words: int
    images: int = 0
    cool_images: int = 0  # warmth pre-filter hits (VS-02 is a vision-LLM judgement; see PROGRESS)


@dataclass
class PdfResult:
    doc: Doc
    pages: list[PdfPage]
    spans: list[PdfSpan]
    hidden: list[HiddenText]
    visual: list[Finding] = field(default_factory=list)  # page-level image findings
    ocr_engine: str = "tesseract"
    links: list[PdfLink] = field(default_factory=list)

    @property
    def hidden_redactions(self) -> list[Redaction]:
        return [Redaction("hidden_text", h.start, h.end) for h in self.hidden]

    def manifest(self, paths: list[str]) -> list[dict[str, Any]]:
        """`review_runs.pages`: what the UI needs to draw each page and its overlays."""
        return [
            {"n": p.n, "width": p.width, "height": p.height, "path": path, "words": p.words}
            for p, path in zip(self.pages, paths, strict=True)
        ]


def _rgb(colour: int) -> tuple[int, int, int]:
    return (colour >> 16) & 255, (colour >> 8) & 255, colour & 255


def _render(page: Any, zoom: float) -> RGB:
    import pymupdf

    matrix = pymupdf.Matrix(zoom, zoom)  # type: ignore[no-untyped-call]
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    arr: RGB = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
    return np.ascontiguousarray(arr[:, :, :3])


def _box(rect: Any, zoom: float) -> Box:
    x0, y0, x1, y1 = rect
    return (round(x0 * zoom), round(y0 * zoom), round(x1 * zoom), round(y1 * zoom))


def _clamp(box: Box, size: tuple[int, int], min_side: int = 8) -> Box:
    w, h = size
    x0 = min(max(box[0], 0), w - min_side)
    y0 = min(max(box[1], 0), h - min_side)
    return (x0, y0, max(x0 + min_side, min(box[2], w)), max(y0 + min_side, min(box[3], h)))


def _hidden_reason(
    span: dict[str, Any], box: Box, size: tuple[int, int], ratio: float | None
) -> HiddenReason | None:
    w, h = size
    if box[2] <= 0 or box[3] <= 0 or box[0] >= w or box[1] >= h:
        return "off_page"
    if span.get("alpha", 255) == 0:
        return "transparent"
    if float(span["size"]) < config.PDF_HIDDEN_PT:
        return "tiny"
    if ratio is not None and ratio < config.FAINT_TEXT_RATIO:
        return "faint"
    return None


class _Builder:
    """Accumulates the Doc text and its word segments across pages."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.segments: list[Segment] = []
        self.pos = 0

    def emit(self, text: str) -> None:
        self.parts.append(text)
        self.pos += len(text)

    def word(self, chars: list[str], boxes: list[Box], page: int) -> None:
        start = self.pos
        self.emit("".join(chars))
        self.segments.append(Segment("".join(chars), start, self.pos, page=page, bbox=union(boxes)))

    @property
    def last(self) -> str:
        return self.parts[-1] if self.parts else ""

    def trim_space(self) -> None:
        if self.last == " ":
            self.parts.pop()
            self.pos -= 1

    def text_from(self, start: int) -> str:
        return "".join(self.parts)[start:]


def _read_page(
    b: _Builder, info: dict[str, Any], n: int, zoom: float, rgb: RGB, size: tuple[int, int]
) -> list[PdfSpan]:
    """One page of PyMuPDF `rawdict` → words (Segments with character-accurate boxes) and spans
    (colour, size, background, hidden reason). Whitespace collapses to one space; lines end in
    a newline."""
    spans: list[PdfSpan] = []
    page_start = b.pos
    for block in info["blocks"]:
        for line in block.get("lines", []):
            raw = [sp for sp in line["spans"] if any(not c["c"].isspace() for c in sp["chars"])]
            if not raw:
                continue
            if b.pos > page_start:
                b.emit("\n")
            line_start = b.pos
            for sp in raw:
                span_start: int | None = None
                chars: list[str] = []
                boxes: list[Box] = []
                for ch in sp["chars"]:
                    if ch["c"].isspace():
                        if chars:
                            b.word(chars, boxes, n)
                            chars, boxes = [], []
                        if b.pos > line_start and b.last != " ":
                            b.emit(" ")
                        continue
                    if span_start is None:
                        span_start = b.pos
                    chars.append(ch["c"])
                    boxes.append(_box(ch["bbox"], zoom))
                if chars:
                    b.word(chars, boxes, n)
                if span_start is None:
                    continue
                box = _box(sp["bbox"], zoom)
                colour = _rgb(int(sp["color"]))
                bg = ring_background(rgb, box)
                ratio = contrast_ratio(colour, bg) if bg else None
                reason = _hidden_reason(sp, box, size, ratio)
                if reason == "off_page":  # pin it to the nearest page edge so it can be drawn
                    box = _clamp(box, size)
                spans.append(
                    PdfSpan(
                        n,
                        span_start,
                        b.pos - (1 if b.last == " " else 0),
                        box,
                        float(sp["size"]),
                        colour,
                        bg,
                        bool(int(sp.get("flags", 0)) & _BOLD),
                        reason,
                    )
                )
            b.trim_space()
    return spans


def ingest_pdf(
    data: bytes,
    kit: VisualKit,
    vault: Vault,
    *,
    ocr_engine: str = "tesseract",
    max_pages: int = config.PDF_MAX_PAGES,
    max_words: int = config.PDF_MAX_WORDS,
) -> PdfResult:
    import pymupdf

    try:
        pdf: Any = pymupdf.open(stream=data, filetype="pdf")  # type: ignore[no-untyped-call]
    except Exception as exc:
        raise IngestError("unreadable_pdf") from exc
    with pdf:
        if pdf.needs_pass:
            raise IngestError("encrypted_pdf", "The PDF is password-protected.")
        if pdf.page_count == 0:
            raise IngestError("empty_version")
        if pdf.page_count > max_pages:
            raise IngestError("too_many_pages", f"{pdf.page_count} pages; the limit is {max_pages}")

        b = _Builder()
        spans: list[PdfSpan] = []
        pages: list[PdfPage] = []
        visual: list[Finding] = []
        links: list[PdfLink] = []

        for index in range(pdf.page_count):
            page: Any = pdf[index]
            n = index + 1
            rect = page.rect
            zoom = min(
                config.PDF_RENDER_MAX_ZOOM,
                config.PDF_RENDER_MAX_SIDE / max(rect.width, rect.height, 1),
            )
            rgb = _render(page, zoom)
            size = (rgb.shape[1], rgb.shape[0])

            if index:
                b.emit("\n\n")
            page_start = b.pos
            # No clip: text placed off the page is extracted and reported as hidden.
            info = page.get_text(
                "rawdict",
                flags=pymupdf.TEXT_PRESERVE_WHITESPACE,
                clip=pymupdf.INFINITE_RECT(),  # type: ignore[no-untyped-call]
            )
            spans += _read_page(b, info, n, zoom, rgb, size)
            links += _links(page, n, zoom, b.segments, page_start)
            pdf_page = PdfPage(
                n,
                size[0],
                size[1],
                zoom,
                encode_png(rgb),
                page_start,
                b.pos,
                len(b.text_from(page_start).split()),
            )
            visual += _page_visuals(page, n, rgb, zoom, kit, vault, pdf_page, ocr_engine)
            pages.append(pdf_page)
            del rgb

    text = b.text_from(0)
    doc = Doc(text=text, original=text, char_map=list(range(len(text))), segments=b.segments)
    if doc.word_count > max_words:
        raise IngestError("too_long", f"{doc.word_count} words; the limit is {max_words}")
    if not text.strip() and not visual:
        # Scanned decks have no text layer; OCRing whole pages is out of scope (see PROGRESS).
        raise IngestError("no_text_layer", "The PDF has no selectable text.")
    hidden = _group_hidden(spans)
    return PdfResult(doc, pages, spans, hidden, visual, ocr_engine, links)


def _links(page: Any, n: int, zoom: float, segments: list[Segment], from_: int) -> list[PdfLink]:
    """Link annotations and the words they cover (a word counts when its centre is inside)."""
    out: list[PdfLink] = []
    for link in page.get_links():
        if "from" not in link:
            continue
        box = _box(link["from"], zoom)
        words = [
            sg
            for sg in segments
            if sg.page == n
            and sg.start >= from_
            and sg.bbox
            and box[0] <= (sg.bbox[0] + sg.bbox[2]) / 2 <= box[2]
            and box[1] <= (sg.bbox[1] + sg.bbox[3]) / 2 <= box[3]
        ]
        if words:
            out.append(PdfLink(n, words[0].start, words[-1].end, box, link.get("uri")))
    return out


def _page_visuals(
    page: Any,
    n: int,
    rgb: RGB,
    zoom: float,
    kit: VisualKit,
    vault: Vault,
    pdf_page: PdfPage,
    ocr_engine: str,
) -> list[Finding]:
    """The logo on the page and the P11 checks on each embedded picture, as page-level findings.

    A raster logo in a PDF is an embedded image, so the logo is searched for only inside image
    placements (padded): ~10x faster than a whole-page multi-scale search on text-only pages, and
    bold headings can't be mistaken for the wordmark. (Vector-drawn logos aren't detected.)"""
    out: list[Finding] = []
    h, w = rgb.shape[:2]
    placements: list[Box] = []
    for item in page.get_image_info():
        x0, y0, x1, y1 = _box(item["bbox"], zoom)
        box = (max(0, x0), max(0, y0), min(w, x1), min(h, y1))
        if box[2] - box[0] >= 8 and box[3] - box[1] >= 4:
            placements.append(box)

    logo_box: Box | None = None
    rule = logo_rule(vault)
    if rule and kit.logos and placements:
        logo = _find_logo(rgb, placements, kit)
        if logo:
            logo_box = logo.box
            # The guide's pixel minimum is in CSS px at 100% zoom (96 px per 72 pt).
            css_width = round(logo.width / zoom * 96 / 72)
            if css_width < kit.min_logo_width_px:
                out.append(
                    _image_finding(
                        rule.dimension,
                        rule.severity,
                        n,
                        logo.box,
                        f"Logo, {css_width} px wide",
                        f"The logo is {css_width} px wide at 100% zoom; the minimum is "
                        f"{kit.min_logo_width_px} px.",
                        rule_id=rule.id,
                        codes=[rule.code],
                    )
                )
            space = clear_space(
                rgb,
                logo.box,
                ratio=kit.clear_space_ratio,
                variance_max=config.CLEAR_SPACE_VARIANCE_MAX,
            )
            if not space.ok:
                out.append(
                    _image_finding(
                        rule.dimension,
                        rule.severity,
                        n,
                        space.ring,
                        "Logo clear space",
                        f"Something sits inside the logo's clear space (the "
                        f"{kit.clear_space_ratio:g}× logo-height margin on every side).",
                        rule_id=rule.id,
                        codes=[rule.code],
                    )
                )

    seen: list[Box] = []
    for box in placements:
        if box[2] - box[0] < config.PDF_IMAGE_MIN_PX or box[3] - box[1] < config.PDF_IMAGE_MIN_PX:
            continue
        if logo_box and overlap_fraction(logo_box, box) > 0.5 and _area(box) < 4 * _area(logo_box):
            continue  # the picture *is* the logo
        if any(overlap_fraction(box, s) > 0.9 for s in seen):
            continue
        seen.append(box)
        pdf_page.images += 1
        crop = np.ascontiguousarray(rgb[box[1] : box[3], box[0] : box[2]])
        analysis = analyse_rgb(crop, kit, ocr_engine=ocr_engine, find_logo=False)
        if analysis.warmth.cool:
            pdf_page.cool_images += 1
        crop_doc = image_doc(analysis, b"")
        found = check_image(analysis, crop_doc, kit, vault, None, standalone=False)
        if crop_doc.text.strip():
            found += run_filters(crop_doc, vault)
        out += [_lift(f, crop_doc, n, (box[0], box[1])) for f in found]
    return out


def _find_logo(rgb: RGB, placements: list[Box], kit: VisualKit) -> LogoMatch | None:
    """The best-correlating logo inside any image placement, in page pixels."""
    h, w = rgb.shape[:2]
    best: LogoMatch | None = None
    for box in placements:
        pad = max(12, round(0.15 * max(box[2] - box[0], box[3] - box[1])))
        x0, y0 = max(0, box[0] - pad), max(0, box[1] - pad)
        x1, y1 = min(w, box[2] + pad), min(h, box[3] + pad)
        crop = np.ascontiguousarray(rgb[y0:y1, x0:x1])
        m = detect_logo(crop, kit.logos, min_inliers=config.LOGO_MIN_GOOD_MATCHES, confirm=True)
        if m and (best is None or m.correlation > best.correlation):
            bx = m.box
            best = replace(m, box=(bx[0] + x0, bx[1] + y0, bx[2] + x0, bx[3] + y0))
    return best


def _area(b: Box) -> int:
    return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def _image_finding(
    dimension: Any,
    severity: Any,
    page: int,
    box: Box,
    quote: str,
    explanation: str,
    **kw: Any,
) -> Finding:
    return Finding(
        dimension=dimension,
        start=0,
        end=0,
        severity=cap_severity(dimension, severity),
        explanation=explanation,
        target="image",
        bbox=box,
        quote=quote,
        page=page,
        **kw,
    )


def _lift(f: Finding, crop_doc: Doc, page: int, origin: tuple[int, int]) -> Finding:
    """A finding on an embedded picture → an image-target finding on its page."""
    ox, oy = origin
    if f.target == "image" and f.bbox:
        box, quote = f.bbox, f.quote or ""
    else:
        box = f.bbox or crop_doc.bbox_for(f.start, f.end) or (0, 0, 0, 0)
        quote = f.quote or crop_doc.text[f.start : f.end]
    return Finding(
        dimension=f.dimension,
        start=0,
        end=0,
        severity=f.severity,
        explanation=f"In a picture on page {page}: {f.explanation}",
        rule_id=f.rule_id,
        fact_id=f.fact_id,
        wcag_ref=f.wcag_ref,
        codes=f.codes,
        rewrite=f.rewrite,
        target="image",
        bbox=(box[0] + ox, box[1] + oy, box[2] + ox, box[3] + oy),
        quote=quote,
        page=page,
    )


def _group_hidden(spans: list[PdfSpan]) -> list[HiddenText]:
    """Adjacent hidden spans on the same page and reason become one hidden run."""
    out: list[HiddenText] = []
    for s in spans:
        if not s.hidden:
            continue
        detail = _detail(s)
        prev = out[-1] if out else None
        if prev and prev.page == s.page and prev.reason == s.hidden and s.start - prev.end <= 2:
            out[-1] = HiddenText(
                s.page, prev.start, s.end, union([prev.box, s.box]), s.hidden, prev.detail
            )
        else:
            out.append(HiddenText(s.page, s.start, s.end, s.box, s.hidden, detail))
    return out


def _detail(s: PdfSpan) -> str:
    if s.hidden == "tiny":
        return f"set in {s.size_pt:g} pt type (below {config.PDF_HIDDEN_PT:g} pt)"
    if s.hidden == "faint" and s.background and s.ratio is not None:
        return (
            f"{rgb_to_hex(s.colour)} on {rgb_to_hex(s.background)}, {s.ratio:.2f} : 1 "
            "(the same colour as its background)"
        )
    if s.hidden == "transparent":
        return "fully transparent"
    return "placed outside the visible page"


# ---------------------------------------------------------------------------------- stage 3


def apply_hidden(findings: list[Finding], pdf: PdfResult, vault: Vault) -> list[Finding]:
    """Hidden text becomes one finding per run (SPEC §6 stage 2): `claims` (merged with the claims
    finding the filters raised on it) if it carries a claim, else `access`. Other deterministic
    findings inside hidden text are folded in: the fix is to remove the text."""
    if not pdf.hidden:
        return findings
    access = text_image_rule(vault)
    out = [f for f in findings if not any(_inside(f, h) for h in pdf.hidden)]
    for h in pdf.hidden:
        inside = [f for f in findings if _inside(f, h) or _overlaps(f, h)]
        claim = next((f for f in inside if f.dimension == "claims"), None)
        out = [f for f in out if f is not claim]
        why = (
            f"Hidden text on page {h.page}: {h.detail}. Readers can't see it, but search engines, "
            "screen readers and AI tools can, so it may conceal a claim or be a prompt-injection "
            "attempt. Remove it, or make it visible and check it like the rest of the deck."
        )
        if claim:
            out.append(
                Finding(
                    dimension="claims",
                    start=h.start,
                    end=h.end,
                    severity=cap_severity("claims", "blocker"),
                    explanation=f"{why} It also makes a claim: {claim.explanation}",
                    rule_id=claim.rule_id,
                    fact_id=claim.fact_id,
                    codes=claim.codes,
                    bbox=h.box,
                )
            )
        elif access:
            wcag = "1.4.3" if h.reason == "faint" else None
            out.append(
                Finding(
                    dimension="access",
                    start=h.start,
                    end=h.end,
                    severity=cap_severity("access", "warning"),
                    explanation=why,
                    rule_id=access.id,
                    wcag_ref=wcag,
                    codes=[access.code] + ([f"WCAG {wcag}"] if wcag else []),
                    bbox=h.box,
                )
            )
    return sorted((f for f in out if f.cited), key=lambda f: (f.start, f.end))


def _inside(f: Finding, h: HiddenText) -> bool:
    return f.target == "text" and h.start <= f.start and f.end <= h.end and f.end > f.start


def _overlaps(f: Finding, h: HiddenText) -> bool:
    return f.target == "text" and f.start < h.end and f.end > h.start


def check_contrast(pdf: PdfResult, vault: Vault) -> list[Finding]:
    """WCAG 1.4.3 on the visible text layer: declared glyph colour vs the rendered background.
    One finding per line run of failing spans (same colours), so a long paragraph is one card."""
    access = text_image_rule(vault)
    if not access:
        return []
    out: list[Finding] = []
    run: list[PdfSpan] = []

    def flush() -> None:
        if not run:
            return
        worst = min(run, key=lambda s: s.ratio or 21)
        assert worst.background is not None and worst.ratio is not None
        need = 3.0 if all(s.large for s in run) else 4.5
        out.append(
            Finding(
                dimension="access",
                start=run[0].start,
                end=run[-1].end,
                severity=cap_severity("access", "warning"),
                explanation=(
                    f"Contrast is {worst.ratio:.2f} : 1 ({rgb_to_hex(worst.colour)} on "
                    f"{rgb_to_hex(worst.background)}); {'large' if need == 3.0 else 'normal'} "
                    f"text needs at least {need:g} : 1."
                ),
                rule_id=access.id,
                wcag_ref="1.4.3",
                codes=[access.code, "WCAG 1.4.3"],
                bbox=union([s.box for s in run]),
            )
        )
        run.clear()

    for s in pdf.spans:
        ratio = s.ratio
        fails = (
            not s.hidden
            and ratio is not None
            and round(ratio, 2) < (3.0 if s.large else 4.5)
            and pdf.doc.text[s.start : s.end].strip() != ""
        )
        if not fails:
            flush()
            continue
        if run and (
            run[-1].page != s.page
            or "\n" in pdf.doc.text[run[-1].end : s.start]
            or (run[-1].colour, run[-1].background) != (s.colour, s.background)
        ):
            flush()
        run.append(s)
    flush()
    return out


def check_links(pdf: PdfResult) -> list[Finding]:
    """WCAG 2.4.4 on link annotations: vague link text ("Click here") or a bare URL as the text."""
    from brandlens_worker.pipeline.filters.access import _BARE_URL, _VAGUE, _link

    out: list[Finding] = []
    for link in pdf.links:
        label = pdf.doc.text[link.start : link.end].strip()
        if _VAGUE.match(label):
            why = f'Link text "{label}" doesn\'t say where it goes.'
        elif _BARE_URL.fullmatch(label):
            why = "A bare URL is read out character by character; use descriptive link text."
        else:
            continue
        out.append(_link(link.start, link.end, why))
    return out


# ---------------------------------------------------------------------------------- stage 5


@dataclass(frozen=True)
class Chunk:
    pages: tuple[int, int]  # first and last page, 1-based
    start: int
    end: int


def page_chunks(pages: list[PdfPage], max_words: int = config.PDF_CHUNK_WORDS) -> list[Chunk]:
    """Whole pages packed into LLM chunks of at most `max_words` (a longer page is its own chunk).
    Pages without text are skipped."""
    chunks: list[Chunk] = []
    cur: list[PdfPage] = []
    words = 0
    for p in pages:
        if not p.words:
            continue
        if cur and words + p.words > max_words:
            chunks.append(Chunk((cur[0].n, cur[-1].n), cur[0].start, cur[-1].end))
            cur, words = [], 0
        cur.append(p)
        words += p.words
    if cur:
        chunks.append(Chunk((cur[0].n, cur[-1].n), cur[0].start, cur[-1].end))
    return chunks


def sub_doc(doc: Doc, start: int, end: int) -> Doc:
    """A chunk of a PDF Doc, re-based to 0 (PDF docs have an identity char map)."""
    text = doc.text[start:end]
    segments = [
        Segment(s.text, s.start - start, s.end - start, s.page, s.bbox)
        for s in doc.segments
        if s.start >= start and s.end <= end
    ]
    return Doc(text=text, original=text, char_map=list(range(len(text))), segments=segments)


def shift(f: Finding, by: int) -> Finding:
    return replace(f, start=f.start + by, end=f.end + by)
