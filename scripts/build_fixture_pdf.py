"""Render fixtures/paywise/guide.md → guide.pdf (headings, page numbers) and the logo SVGs → PNG.

Run from the worker venv:  cd apps/worker && uv run python ../../scripts/build_fixture_pdf.py
The output is committed so tests and the demo don't depend on this script.
"""

from __future__ import annotations

import html
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "fixtures" / "paywise"

PAGE = pymupdf.paper_rect("a4")
MARGIN = 64
BODY = pymupdf.Rect(
    PAGE.x0 + MARGIN, PAGE.y0 + MARGIN + 18, PAGE.x1 - MARGIN, PAGE.y1 - MARGIN - 10
)

CSS = """
* { font-family: sans-serif; }
body { font-size: 10.5pt; line-height: 1.45; color: #141414; }
h1 { font-family: serif; font-size: 26pt; margin: 0 0 6pt 0; color: #141414; }
h2 { font-family: serif; font-size: 17pt; margin: 16pt 0 6pt 0; color: #B8301C; }
h3 { font-size: 12.5pt; font-weight: bold; margin: 12pt 0 4pt 0; }
p { margin: 0 0 6pt 0; }
ul { margin: 0 0 6pt 0; }
li { margin: 0 0 2pt 0; }
.meta { font-size: 9pt; color: #5F5B53; margin-bottom: 14pt; }
"""

_INLINE = [
    (re.compile(r"\*\*(.+?)\*\*"), r"<b>\1</b>"),
    (re.compile(r"(?<!\*)\*(?!\*)(.+?)\*"), r"<i>\1</i>"),
    (re.compile(r"`(.+?)`"), r"<code>\1</code>"),
]


def inline(text: str) -> str:
    out = html.escape(text, quote=False)
    for pattern, repl in _INLINE:
        out = pattern.sub(repl, out)
    return out


def md_to_html(md: str) -> str:
    """Enough Markdown for the guide: #/##/### headings, paragraphs, '- ' lists, inline marks."""
    parts: list[str] = []
    para: list[str] = []
    items: list[str] = []
    first_para_after_h1 = False

    def flush() -> None:
        nonlocal para, items, first_para_after_h1
        if para:
            cls = ' class="meta"' if first_para_after_h1 else ""
            parts.append(f"<p{cls}>{inline(' '.join(para))}</p>")
            first_para_after_h1 = False
            para = []
        if items:
            parts.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>")
            items = []

    for raw in md.splitlines():
        line = raw.rstrip()
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            flush()
            level = len(m[1])
            parts.append(f"<h{level}>{inline(m[2])}</h{level}>")
            first_para_after_h1 = level == 1
        elif line.startswith("- "):
            if para:
                flush()
            items.append(line[2:])
        elif not line.strip():
            flush()
        else:
            if items:
                flush()
            para.append(line.strip())
    flush()
    return "\n".join(parts)


def build_pdf(md_path: Path, pdf_path: Path) -> int:
    story = pymupdf.Story(html=md_to_html(md_path.read_text()), user_css=CSS)
    writer = pymupdf.DocumentWriter(str(pdf_path))
    more = True
    while more:
        device = writer.begin_page(PAGE)
        more, _ = story.place(BODY)
        story.draw(device)
        writer.end_page()
    writer.close()

    doc = pymupdf.open(str(pdf_path))
    total = doc.page_count
    for page in doc:
        n = page.number + 1
        page.insert_text(
            (MARGIN, MARGIN - 8), "PayWise Brand Guide · v3.2", fontsize=8, color=(0.37, 0.36, 0.33)
        )
        page.insert_text(
            (PAGE.width - MARGIN - 40, PAGE.height - MARGIN + 24),
            f"Page {n} of {total}",
            fontsize=8,
            color=(0.37, 0.36, 0.33),
        )
    doc.set_metadata({"title": "PayWise Brand Guide", "author": "PayWise (fictional)"})
    doc.saveIncr()
    doc.close()
    return total


def render_logos(logo_dir: Path, widths: tuple[int, ...] = (480,)) -> list[Path]:
    written = []
    for svg in sorted(logo_dir.glob("*.svg")):
        src = pymupdf.open(stream=svg.read_bytes(), filetype="svg")
        page = src[0]
        for width in widths:
            zoom = width / page.rect.width
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=True)
            out = svg.with_suffix(".png")
            pix.save(str(out))
            written.append(out)
        src.close()
    return written


def main() -> None:
    pages = build_pdf(KIT / "guide.md", KIT / "guide.pdf")
    print(f"guide.pdf: {pages} pages")
    for path in render_logos(KIT / "logos"):
        print(f"rendered {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
