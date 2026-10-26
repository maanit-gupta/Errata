"""Brand guide → draft rule cards (SPEC §12). Pure functions; I/O lives in jobs/ingest_guide.py.

parse (PDF font sizes / DOCX heading styles / Markdown headings) → sections → chunks (≤1,500
tokens) → one structured LLM call per chunk → dedupe by embedding similarity → assign codes.
"""

from __future__ import annotations

import io
import re
import unicodedata
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, Field

RuleDimension = Literal["tone", "terms", "claims", "visual", "access", "facts"]
SeverityLit = Literal["blocker", "warning", "suggestion"]

CODE_PREFIX: dict[str, str] = {
    "tone": "TV",
    "terms": "G",
    "claims": "CL",
    "visual": "VS",
    "access": "A",
    "facts": "FR",
}
CHARS_PER_TOKEN = 4
# SPEC §12 caps chunks at 1,500 tokens; smaller chunks extract noticeably more rules per guide.
MAX_CHUNK_TOKENS = 700
DEDUPE_COSINE = 0.92


# --------------------------------------------------------------------------- LLM schema


class DraftExample(BaseModel):
    kind: Literal["do", "dont"]
    text: str = Field(max_length=400)


class RuleCardDraft(BaseModel):
    code_suggestion: str | None = Field(
        default=None, description="The guide's own code for this rule if it has one, e.g. CL-03"
    )
    dimension: RuleDimension
    title: str = Field(max_length=160)
    summary: str = Field(max_length=400, description="One sentence, safe to show to agencies")
    body: str = Field(max_length=2000)
    examples: list[DraftExample] = Field(default_factory=list, max_length=6)
    severity: SeverityLit
    source_page: int | None = Field(
        default=None, description="Page number from the [page N] markers"
    )


class RuleCardDrafts(BaseModel):
    cards: list[RuleCardDraft] = Field(default_factory=list)


# --------------------------------------------------------------------------- parsing


@dataclass
class Section:
    title: str
    level: int
    page: int | None
    text: str = ""


@dataclass
class Chunk:
    text: str
    pages: list[int] = field(default_factory=list)

    @property
    def first_page(self) -> int | None:
        return self.pages[0] if self.pages else None


def parse_pdf(data: bytes) -> list[Section]:
    """Sections by heading, where a heading is a short line set ≥15% larger than body text.

    Running headers and footers (top/bottom 7% of the page) are ignored.
    """
    import pymupdf

    doc: Any = pymupdf.open(stream=data, filetype="pdf")  # type: ignore[no-untyped-call]
    lines: list[tuple[int, float, str]] = []  # (page, size, text)
    sizes: Counter[float] = Counter()
    for page in doc:
        height = page.rect.height
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                y0, y1 = line["bbox"][1], line["bbox"][3]
                if y1 < height * 0.07 or y0 > height * 0.93:
                    continue
                # NFKC folds typographic ligatures (ﬁ → fi) so quotes match the draft text.
                text = unicodedata.normalize(
                    "NFKC", "".join(s["text"] for s in line["spans"])
                ).strip()
                if not text:
                    continue
                size = round(max(s["size"] for s in line["spans"]), 1)
                lines.append((page.number + 1, size, text))
                sizes[size] += len(text)
    doc.close()
    if not lines:
        return []

    body = sizes.most_common(1)[0][0]
    heading_sizes = sorted(
        {s for _, s, t in lines if s >= body * 1.15 and len(t) <= 120}, reverse=True
    )
    level_of = {s: i + 1 for i, s in enumerate(heading_sizes)}

    sections: list[Section] = []
    current = Section(title="", level=0, page=lines[0][0])
    for page_no, size, text in lines:
        if size in level_of and len(text) <= 120:
            if current.title or current.text:
                sections.append(current)
            current = Section(title=text, level=level_of[size], page=page_no)
        else:
            current.text = f"{current.text} {text}".strip() if current.text else text
    if current.title or current.text:
        sections.append(current)
    return _merge_wrapped_headings(sections)


def _merge_wrapped_headings(sections: list[Section]) -> list[Section]:
    """A heading that wrapped onto two lines arrives as two empty sections at the same level."""
    merged: list[Section] = []
    for s in sections:
        prev = merged[-1] if merged else None
        if prev and not prev.text and prev.level == s.level and prev.page == s.page and s.level:
            prev.title = f"{prev.title} {s.title}"
            prev.text = s.text
        else:
            merged.append(s)
    return merged


def parse_docx(data: bytes) -> list[Section]:
    import docx

    document = docx.Document(io.BytesIO(data))
    sections: list[Section] = []
    current = Section(title="", level=0, page=None)
    for para in document.paragraphs:
        style = (para.style.name if para.style is not None else "") or ""
        text = para.text.strip()
        if not text:
            continue
        m = re.match(r"^(Title|Heading)\s*(\d*)$", style)
        if m:
            if current.title or current.text:
                sections.append(current)
            level = 1 if m[1] == "Title" else int(m[2] or 1)
            current = Section(title=text, level=level, page=None)
        else:
            current.text = f"{current.text}\n{text}".strip()
    if current.title or current.text:
        sections.append(current)
    return sections


def parse_markdown(md: str) -> list[Section]:
    sections: list[Section] = []
    current = Section(title="", level=0, page=None)
    for raw in md.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)$", raw.strip())
        if m:
            if current.title or current.text:
                sections.append(current)
            current = Section(title=m[2].strip(), level=len(m[1]), page=None)
        elif raw.strip():
            current.text = f"{current.text}\n{raw.strip()}".strip()
    if current.title or current.text:
        sections.append(current)
    return sections


def chunk_sections(sections: Sequence[Section], max_tokens: int = MAX_CHUNK_TOKENS) -> list[Chunk]:
    """Pack whole sections into chunks of ≤ max_tokens (≈4 chars/token). Each chunk's text marks
    pages with `[page N]` so the model can report `source_page`. Oversized sections are split by
    sentence."""
    limit = max_tokens * CHARS_PER_TOKEN
    chunks: list[Chunk] = []
    buf: list[str] = []
    pages: list[int] = []
    size = 0
    last_page: int | None = None

    def flush() -> None:
        nonlocal buf, pages, size, last_page
        if buf:
            chunks.append(Chunk(text="\n".join(buf).strip(), pages=pages))
        buf, pages, size, last_page = [], [], 0, None

    for s in sections:
        heading = f"{'#' * max(s.level, 1)} {s.title}" if s.title else ""
        for piece in _split(s.text, limit - len(heading) - 20) or [""]:
            block = "\n".join(x for x in (heading, piece) if x)
            marker = f"[page {s.page}]" if s.page is not None and s.page != last_page else ""
            add = len(block) + len(marker) + 2
            if size + add > limit:
                flush()
                marker = f"[page {s.page}]" if s.page is not None else ""
            if marker:
                buf.append(marker)
                last_page = s.page
            if s.page is not None and s.page not in pages:
                pages.append(s.page)
            buf.append(block)
            size += add
    flush()
    return chunks


def _split(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text] if text else []
    out: list[str] = []
    cur = ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if cur and len(cur) + len(sentence) + 1 > limit:
            out.append(cur)
            cur = ""
        cur = f"{cur} {sentence}".strip()
        while len(cur) > limit:  # a single giant "sentence"
            out.append(cur[:limit])
            cur = cur[limit:]
    if cur:
        out.append(cur)
    return out


# --------------------------------------------------------------------------- post-processing


_DASHES = str.maketrans({"\u2010": "-", "\u2011": "-", "\u2012": "-", "\u00a0": " "})
_CODE_PREFIX = re.compile(r"^\s*(?P<code>[A-Z]{1,3}-\d{1,3})\s*[:·.\-\u2013\u2014]?\s*")
_CODE_SUFFIX = re.compile(r"\s*\((?P<code>[A-Z]{1,3}-\d{1,3})\)\s*$")


def _tidy(text: str) -> str:
    return unicodedata.normalize("NFKC", text).translate(_DASHES).strip()


def clamp_pages(drafts: Sequence[RuleCardDraft], chunk: Chunk) -> list[RuleCardDraft]:
    """Post-process model drafts: never trust its page numbers (keep only pages this chunk covers),
    drop a code it echoed into the title, and normalise odd Unicode hyphens/spaces."""
    fixed = []
    for d in drafts:
        page = d.source_page if d.source_page in chunk.pages else chunk.first_page
        title = _tidy(d.title)
        code = d.code_suggestion
        for pattern in (_CODE_PREFIX, _CODE_SUFFIX):
            m = pattern.search(title)
            if m:
                code = code or m["code"]  # the model sometimes puts the code only in the title
                title = (title[: m.start()] + title[m.end() :]).strip() or title
        fixed.append(
            d.model_copy(
                update={
                    "source_page": page,
                    "code_suggestion": code,
                    "title": title,
                    "summary": _tidy(d.summary),
                    "body": _tidy(d.body),
                    "examples": [e.model_copy(update={"text": _tidy(e.text)}) for e in d.examples],
                }
            )
        )
    return fixed


def draft_text(d: RuleCardDraft) -> str:
    return f"{d.title}\n{d.summary}\n{d.body}"


def dedupe(
    drafts: Sequence[RuleCardDraft],
    embed: Callable[[list[str]], npt.NDArray[np.float32]],
    threshold: float = DEDUPE_COSINE,
) -> list[RuleCardDraft]:
    """Drop drafts whose embedding is > threshold similar to an earlier kept draft."""
    if not drafts:
        return []
    vecs = embed([draft_text(d) for d in drafts])
    kept: list[int] = []
    for i in range(len(drafts)):
        if all(float(np.dot(vecs[i], vecs[j])) <= threshold for j in kept):
            kept.append(i)
    return [drafts[i] for i in kept]


@dataclass(frozen=True)
class CodedDraft:
    draft: RuleCardDraft
    code: str
    version: int


def assign_codes(drafts: Sequence[RuleCardDraft], existing: dict[str, int]) -> list[CodedDraft]:
    """Pick a code and version for each draft.

    - The guide's own code (if it has the right prefix for the dimension) is kept. If that code
      already exists in the org, the draft becomes the next *version* of it (a proposed update).
    - Otherwise, or if the code is already taken in this batch, the next free number is used.
    `existing` maps code → highest version in the org.
    """
    used: set[str] = set()
    numbers: dict[str, set[int]] = {}
    for code in existing:
        m = re.match(r"^([A-Z]+)-(\d+)$", code)
        if m:
            numbers.setdefault(m[1], set()).add(int(m[2]))

    out: list[CodedDraft] = []
    for d in drafts:
        prefix = CODE_PREFIX[d.dimension]
        suggestion = (d.code_suggestion or "").strip().upper()
        m = re.match(rf"^{prefix}-(\d{{1,3}})$", suggestion)
        if m and suggestion not in used:
            code = f"{prefix}-{int(m[1]):02d}"
        else:
            taken = numbers.setdefault(prefix, set())
            n = max(taken, default=0) + 1
            code = f"{prefix}-{n:02d}"
        used.add(code)
        num = int(code.split("-")[1])
        numbers.setdefault(prefix, set()).add(num)
        out.append(CodedDraft(draft=d, code=code, version=existing.get(code, 0) + 1))
    return out
