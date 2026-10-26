"""Stage 1: version → Doc (SPEC §6). Normalises whitespace but keeps a char map to the original."""

from __future__ import annotations

import html
import io
import re
from html.parser import HTMLParser
from typing import ClassVar

from brandlens_worker import config
from brandlens_worker.pipeline.types import Doc, Segment


class IngestError(Exception):
    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


_WS = re.compile(r"[ \t\u00a0\u2000-\u200a\u202f\u205f\u3000]+")


def normalise(original: str) -> Doc:
    """Collapse runs of horizontal whitespace (and NBSPs) to one space and CRLF to LF.

    Every kept character records its index in `original`, so finding spans map back exactly.
    """
    out: list[str] = []
    cmap: list[int] = []
    i = 0
    n = len(original)
    while i < n:
        ch = original[i]
        if ch == "\r":
            if i + 1 < n and original[i + 1] == "\n":
                i += 1
                continue
            ch = "\n"
        m = _WS.match(original, i)
        if m:
            out.append(" ")
            cmap.append(i)
            i = m.end()
            continue
        out.append(ch)
        cmap.append(i)
        i += 1
    text = "".join(out)
    return Doc(text=text, original=original, char_map=cmap, segments=_paragraphs(text))


def _paragraphs(text: str) -> list[Segment]:
    segs = []
    for m in re.finditer(r"[^\n]+", text):
        if m.group().strip():
            segs.append(Segment(text=m.group(), start=m.start(), end=m.end()))
    return segs


class _TextExtractor(HTMLParser):
    BLOCK: ClassVar[frozenset[str]] = frozenset(
        {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "section", "article"}
    )

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skip += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self._skip -= 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def html_to_text(markup: str) -> str:
    p = _TextExtractor()
    p.feed(markup)
    text = html.unescape("".join(p.parts))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def docx_to_text(data: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(data))
    return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())


def ingest(
    fmt: str,
    *,
    body: str | None = None,
    data: bytes | None = None,
    max_words: int = config.MAX_WORDS,
) -> Doc:
    """Build a Doc from a version. Text and markdown are used as-is (the editor's plain text)."""
    if fmt in ("text", "markdown"):
        if body is None:
            raise IngestError("empty_version")
        source = body
    elif fmt == "html":
        if body is None:
            raise IngestError("empty_version")
        source = html_to_text(body)
    elif fmt == "docx":
        if data is None:
            raise IngestError("missing_file")
        source = docx_to_text(data)
    elif fmt in ("pdf", "image"):
        raise NotImplementedError(f"{fmt} ingestion lands in P11/P12")
    else:
        raise IngestError("unsupported_format")

    doc = normalise(source)
    if not doc.text.strip():
        raise IngestError("empty_version")
    if doc.word_count > max_words:
        raise IngestError("too_long", f"{doc.word_count} words; the limit is {max_words}")
    return doc
