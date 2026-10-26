"""Confidence for LLM findings (SPEC §7): max similarity of the cited items × agreement.

Deterministic findings are 1.0. `self_confidence` from the model never feeds the score.
"""

from __future__ import annotations

from collections.abc import Iterable


def spans_overlap(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def agreement(
    severity: str,
    dimension: str,
    span: tuple[int, int],
    confirmation: Iterable[tuple[str, tuple[int, int]]] | None,
) -> float:
    """1.0 for non-blockers (single sample). For blockers: 1.0 if the confirmation sample has a
    finding with the same dimension and an overlapping quote, else 0.5."""
    if severity != "blocker":
        return 1.0
    if confirmation is None:
        return 0.5
    return 1.0 if any(d == dimension and spans_overlap(span, s) for d, s in confirmation) else 0.5


def confidence(similarities: Iterable[float], agree: float) -> float:
    sims = list(similarities)
    return round(max(sims, default=0.0) * agree, 4)
