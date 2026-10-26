"""Helpers shared by the filters."""

from __future__ import annotations

from collections.abc import Iterable

from brandlens_worker.config import DIMENSION_MAX_SEVERITY
from brandlens_worker.pipeline.types import Rule, Severity

_RANK = {"suggestion": 0, "warning": 1, "blocker": 2}


def cap_severity(dimension: str, severity: Severity) -> Severity:
    """Precision gate (invariant 10): a dimension can't exceed its configured maximum."""
    cap = DIMENSION_MAX_SEVERITY.get(dimension, "suggestion")  # type: ignore[call-overload]
    return severity if _RANK[severity] <= _RANK[cap] else cap


def pick_rule(rules: Iterable[Rule], *keywords: str) -> Rule | None:
    """The rule whose title/body mentions any keyword; else the first rule (stable by code)."""
    ordered = sorted(rules, key=lambda r: r.code)
    for rule in ordered:
        haystack = f"{rule.title}\n{rule.body}".lower()
        if any(k.lower() in haystack for k in keywords):
            return rule
    return ordered[0] if ordered else None


def is_word_char(ch: str) -> bool:
    return ch.isalnum() or ch == "_"


def on_word_boundary(text: str, start: int, end: int) -> bool:
    before = text[start - 1] if start > 0 else " "
    after = text[end] if end < len(text) else " "
    return not is_word_char(before) and not is_word_char(after)
