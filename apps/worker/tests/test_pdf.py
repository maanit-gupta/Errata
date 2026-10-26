"""P12 PDF decks against fixtures/paywise/deck_labels.json (no network, no LLM)."""

from __future__ import annotations

from functools import cache
from typing import Any

import pymupdf
import pytest

from brandlens_worker.jobs.review_version import to_row
from brandlens_worker.llm.cache import LLMCache
from brandlens_worker.llm.router import LLMRouter
from brandlens_worker.pipeline.ingest import IngestError
from brandlens_worker.pipeline.pdf import (
    Chunk,
    PdfPage,
    ingest_pdf,
    page_chunks,
    sub_doc,
)
from brandlens_worker.pipeline.run import (
    StagesResult,
    VersionInput,
    run_stages_1_to_4,
    run_stages_5_6,
)
from brandlens_worker.pipeline.types import Doc, Segment
from tests.fakes import ScriptedProvider
from tests.kit_fixture import INTENT, fake_embed, kit
from tests.pdf_labels import DECK, LABELS, fake_match, matches, page_and_box
from tests.vault_fixture import paywise_vault


@cache
def _stages() -> StagesResult:
    import asyncio

    return asyncio.run(
        run_stages_1_to_4(
            VersionInput(format="pdf", data=DECK, intent=INTENT, kit=kit()),
            paywise_vault(),
            embed=fake_embed,
            match_vault=fake_match,
            topk=8,
        )
    )


def test_deck_findings_match_labels_with_boxes() -> None:
    """Every seeded issue is found on its page with an overlapping box, and nothing else is."""
    s = _stages()
    assert s.pdf is not None and len(s.pdf.pages) == LABELS["pages"]
    assert [p.width for p in s.pdf.pages] == [LABELS["page_size_px"][0]] * LABELS["pages"]
    unmatched = [e for e in LABELS["expected"] if not any(matches(f, s.doc, e) for f in s.findings)]
    assert unmatched == []
    extra = [
        (f.codes, f.quote or s.doc.text[f.start : f.end])
        for f in s.findings
        if not any(matches(f, s.doc, e) for e in LABELS["expected"])
    ]
    assert extra == []
    clean = set(LABELS["clean_pages"])
    assert not [f for f in s.findings if page_and_box(f, s.doc)[0] in clean]
    assert all(f.cited for f in s.findings)


def test_hidden_text_is_a_finding_and_never_reaches_the_llm() -> None:
    s = _stages()
    assert s.pdf is not None
    reasons = {h.reason for h in s.pdf.hidden}
    assert reasons == {"faint", "tiny"}
    injection = next(f for f in s.findings if "Ignore previous" in s.doc.text[f.start : f.end])
    assert (injection.dimension, injection.severity) == ("claims", "blocker")
    assert "prompt-injection" in injection.explanation
    # Folded in: no separate CL-03 on the same words.
    assert sum(1 for f in s.findings if f.start == injection.start and f.target == "text") == 1
    assert "Ignore previous" not in s.redacted.text
    assert "Internal draft" not in s.redacted.text
    assert s.redacted.text.count("⟦REDACTED:hidden_text⟧") == 2


def test_word_boxes_are_page_scoped() -> None:
    s = _stages()
    i = s.doc.text.index("Paywise app")
    box = s.doc.bbox_for(i, i + len("Paywise app"))
    label = next(e for e in LABELS["expected"] if e.get("code") == "G-07")
    assert box is not None and s.doc.page_for(i, i + 1) == 4
    assert max(abs(a - b) for a, b in zip(box, label["box"], strict=True)) <= 3

    # A span across a page break is boxed on its first page only.
    doc = Doc(
        text="ab\n\ncd",
        original="ab\n\ncd",
        char_map=list(range(6)),
        segments=[Segment("ab", 0, 2, page=1, bbox=(0, 0, 10, 10)),
                  Segment("cd", 4, 6, page=2, bbox=(50, 50, 60, 60))],
    )  # fmt: skip
    assert doc.bbox_for(0, 6) == (0, 0, 10, 10)
    assert doc.page_for(4, 6) == 2


def test_persisted_span_carriespage_and_box() -> None:
    s = _stages()
    codes = {r.id: r.code for r in paywise_vault().rules} | {
        f.id: f.code for f in paywise_vault().facts
    }
    rows = [to_row(f, s.doc, codes) for f in s.findings]
    for r in rows:
        assert 1 <= r["span"]["page"] <= 4
        assert {"x0", "y0", "x1", "y1"} <= r["span"].keys()
    facts = next(r for r in rows if r["dimension"] == "facts")
    assert facts["span"]["page"] == 2 and facts["quote"].startswith("Oct 18")
    picture = next(r for r in rows if r["quote"] == "Assured returns")
    assert "start" not in picture["span"]  # an image-target finding


def test_manifest_and_thumbnails() -> None:
    s = _stages()
    assert s.pdf is not None
    paths = [f"org/content/version/page-{p.n}.png" for p in s.pdf.pages]
    manifest = s.pdf.manifest(paths)
    assert [m["n"] for m in manifest] == [1, 2, 3, 4]
    assert all(p.png.startswith(b"\x89PNG") for p in s.pdf.pages)
    assert manifest[2]["words"] > 0


def _pdf(pages: int, words_per_page: int = 5, *, off_page: str = "") -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page(width=400, height=300)
        for line in range(0, words_per_page, 5):
            words = " ".join(f"word{i}" for _ in range(min(5, words_per_page - line)))
            page.insert_text((20, 40 + line * 2), words, fontsize=9)
        if off_page:
            page.insert_text((20, 340), off_page, fontsize=12)
    return bytes(doc.tobytes())


def test_page_cap_and_bad_input() -> None:
    with pytest.raises(IngestError) as exc:
        ingest_pdf(_pdf(41), kit(), paywise_vault())
    assert exc.value.code == "too_many_pages"
    assert ingest_pdf(_pdf(3), kit(), paywise_vault(), max_pages=3).pages[-1].n == 3
    with pytest.raises(IngestError) as exc:
        ingest_pdf(b"not a pdf", kit(), paywise_vault())
    assert exc.value.code == "unreadable_pdf"
    with pytest.raises(IngestError) as exc:
        ingest_pdf(_pdf(2, 40), kit(), paywise_vault(), max_words=50)
    assert exc.value.code == "too_long"


def test_text_placed_off_the_page_is_hidden() -> None:
    result = ingest_pdf(_pdf(1, off_page="Zero risk returns"), kit(), paywise_vault())
    [hidden] = result.hidden
    assert hidden.reason == "off_page"
    assert result.doc.text[hidden.start : hidden.end] == "Zero risk returns"


def _page(n: int, start: int, end: int, words: int) -> PdfPage:
    return PdfPage(n, 10, 10, 1.0, b"", start, end, words)


def test_page_chunks_pack_whole_pages() -> None:
    pages = [_page(1, 0, 10, 300), _page(2, 12, 20, 300), _page(3, 22, 30, 0),
             _page(4, 32, 40, 300), _page(5, 42, 50, 900)]  # fmt: skip
    assert page_chunks(pages, max_words=700) == [
        Chunk((1, 2), 0, 20),
        Chunk((4, 4), 32, 40),
        Chunk((5, 5), 42, 50),
    ]


async def test_pdf_llm_is_called_once_per_chunk_and_offsets_map_back() -> None:
    s = _stages()
    assert s.pdf is not None
    chunks = page_chunks(s.pdf.pages, max_words=20)  # force several chunks on the small deck
    import brandlens_worker.pipeline.pdf as pdf_mod

    real = pdf_mod.page_chunks
    pdf_mod.page_chunks = lambda pages, max_words=20: real(pages, max_words)  # type: ignore[assignment]
    try:
        tone = {"dimension": "tone", "cites": ["TV-02"], "severity": "suggestion",
                "quote": "Bring your questions about SIPs.", "explanation": "Flat; add warmth."}  # fmt: skip
        script: list[Any] = [{"findings": []} for _ in chunks]
        page2 = next(i for i, c in enumerate(chunks) if c.pages[0] <= 2 <= c.pages[1])
        script[page2] = {"findings": [tone]}
        provider = ScriptedProvider("groq", script)
        out = await run_stages_5_6(
            s,
            paywise_vault(),
            INTENT,
            router=LLMRouter([provider], cache=LLMCache(enabled=False)),
            embed_sync=None,
        )
    finally:
        pdf_mod.page_chunks = real
    assert provider.calls == len(chunks) > 1
    assert out.timings["llm_calls"] == len(chunks)
    [f] = out.findings
    assert s.doc.text[f.start : f.end] == "Bring your questions about SIPs."
    assert s.doc.page_for(f.start, f.end) == 2


def test_sub_doc_rebases_segments() -> None:
    s = _stages()
    assert s.pdf is not None
    p3 = s.pdf.pages[2]
    sub = sub_doc(s.doc, p3.start, p3.end)
    assert sub.text == s.doc.text[p3.start : p3.end]
    assert all(seg.page == 3 for seg in sub.segments)
    assert sub.segments[0].start == 0
