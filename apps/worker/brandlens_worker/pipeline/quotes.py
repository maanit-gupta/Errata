"""Locate a model-supplied quote in the draft. Exact first, then normalised (case, whitespace,
curly↔straight quotes, dash variants). Offsets are always computed locally (invariant 2)."""

from __future__ import annotations

import re

_TRANSLATE = str.maketrans(
    {
        "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
        "“": '"', "”": '"', "„": '"', "″": '"',
        "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "−": "-",
        " ": " ",
    }
)  # fmt: skip


def normalise_with_map(text: str) -> tuple[str, list[int]]:
    """Lower-cased, punctuation-folded, whitespace-collapsed text plus a map back to `text`."""
    out: list[str] = []
    cmap: list[int] = []
    prev_space = False
    for i, ch in enumerate(text.translate(_TRANSLATE)):
        if ch.isspace():
            if prev_space or not out:
                continue
            out.append(" ")
            cmap.append(i)
            prev_space = True
            continue
        prev_space = False
        out.append(ch.lower())
        cmap.append(i)
    return "".join(out), cmap


def find_quote(
    text: str, quote: str, claimed: list[tuple[int, int]] | None = None
) -> tuple[int, int] | None:
    """First occurrence of `quote` in `text` not overlapping a `claimed` span."""
    claimed = claimed or []
    quote = quote.strip().strip('"').strip()
    if not quote:
        return None

    def free(s: int, e: int) -> bool:
        return all(e <= cs or s >= ce for cs, ce in claimed)

    for m in re.finditer(re.escape(quote), text):
        if free(m.start(), m.end()):
            return m.start(), m.end()

    norm_text, cmap = normalise_with_map(text)
    norm_quote, _ = normalise_with_map(quote)
    norm_quote = norm_quote.strip()
    if not norm_quote:
        return None
    start = norm_text.find(norm_quote)
    while start != -1:
        end = start + len(norm_quote)
        s, e = cmap[start], cmap[end - 1] + 1
        if free(s, e):
            return s, e
        start = norm_text.find(norm_quote, start + 1)
    return None
