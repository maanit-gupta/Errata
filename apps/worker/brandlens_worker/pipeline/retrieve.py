"""Stage 4: retrieval queries and merging (SPEC §6).

The job embeds the queries and calls match_vault.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

MAX_SENTENCE_QUERIES = 24
_SENTENCE = re.compile(r"[^.!?\n]+(?:[.!?]+|$)")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE.findall(text) if len(s.split()) >= 3]


def build_queries(text: str) -> list[str]:
    """Whole draft first, then its sentences (longest first, capped)."""
    sentences = split_sentences(text)
    if len(sentences) > MAX_SENTENCE_QUERIES:
        sentences = sorted(sentences, key=len, reverse=True)[:MAX_SENTENCE_QUERIES]
    queries = [text.strip()]
    queries += [s for s in sentences if s != queries[0]]
    return queries


def merge(
    results: Iterable[Iterable[dict[str, Any]]], limit: int | None = None
) -> list[dict[str, Any]]:
    """Merge per-query match_vault rows by id, keeping the max similarity."""
    best: dict[str, dict[str, Any]] = {}
    for rows in results:
        for row in rows:
            key = str(row["id"])
            if key not in best or float(row["similarity"]) > float(best[key]["similarity"]):
                best[key] = row
    merged = sorted(best.values(), key=lambda r: float(r["similarity"]), reverse=True)
    return merged[:limit] if limit else merged


def to_retrieved(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """The shape stored in review_runs.retrieved: [{id, code, kind, dimension, similarity}]."""
    return [
        {
            "id": str(r["id"]),
            "code": r["code"],
            "kind": r["kind"],
            "dimension": r["dimension"],
            "similarity": round(float(r["similarity"]), 4),
        }
        for r in rows
    ]
