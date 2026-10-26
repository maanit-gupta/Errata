"""Stage 2: redact PII and secrets from the LLM-bound copy (SPEC §6, invariant 5).

Deterministic stages keep using the original Doc. Redactions are replaced with ⟦REDACTED:kind⟧.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass

from brandlens_worker.pipeline.types import Doc, RedactedDoc, Redaction


def luhn_ok(digits: str) -> bool:
    nums = [int(c) for c in digits if c.isdigit()]
    if not 13 <= len(nums) <= 19:
        return False
    total = 0
    for i, d in enumerate(reversed(nums)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


# PAN: 5 letters, 4 digits, 1 letter; the 4th letter is the holder type.
_PAN_HOLDER_TYPES = set("ABCFGHJLPT")


def pan_ok(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", value)) and value[3] in _PAN_HOLDER_TYPES


@dataclass(frozen=True)
class Detector:
    kind: str
    pattern: re.Pattern[str]
    validate: Callable[[str], bool] | None = None


DETECTORS: list[Detector] = [
    # Secrets first: they're the most damaging to leak and can contain digit runs.
    Detector("secret", re.compile(r"\bsk-[A-Za-z0-9_-]{16,}")),
    Detector("secret", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    Detector("secret", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
    Detector("secret", re.compile(r"\b(?:gsk|ghp|xox[bpa])_[A-Za-z0-9_-]{16,}")),
    Detector("secret", re.compile(r"\b[a-fA-F0-9]{32,}\b")),
    Detector("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    Detector(
        "card",
        re.compile(r"\b\d(?:[ -]?\d){12,18}\b"),
        lambda s: luhn_ok(s),
    ),
    Detector(
        "aadhaar",
        re.compile(r"\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b"),
    ),
    Detector("pan", re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"), pan_ok),
    Detector("ifsc", re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")),
    Detector(
        "account_number",
        re.compile(r"(?i)\b(?:a/c|acct|account)(?:\s*(?:no\.?|number|#))?\s*[:\-]?\s*(\d{9,18})\b"),
    ),
    Detector("phone", re.compile(r"(?<![\d+])(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b")),
]


def detect(text: str) -> list[Redaction]:
    """All detector hits, overlaps resolved in favour of the earliest-listed detector, then the
    longest span."""
    hits: list[tuple[int, int, int, str]] = []  # (priority, start, end, kind)
    for priority, det in enumerate(DETECTORS):
        for m in det.pattern.finditer(text):
            start, end = (m.start(1), m.end(1)) if m.re.groups else (m.start(), m.end())
            if det.validate and not det.validate(text[start:end]):
                continue
            hits.append((priority, start, end, det.kind))
    hits.sort(key=lambda h: (h[0], -(h[2] - h[1]), h[1]))
    taken: list[Redaction] = []
    for _, start, end, kind in hits:
        if all(end <= r.start or start >= r.end for r in taken):
            taken.append(Redaction(kind=kind, start=start, end=end))
    return sorted(taken, key=lambda r: r.start)


def protect(doc: Doc, extra: list[Redaction] | None = None) -> RedactedDoc:
    """`extra` spans (e.g. hidden PDF text) are redacted too and win over detector hits."""
    redactions = sorted(extra or [], key=lambda r: r.start)
    redactions += [
        r for r in detect(doc.text) if all(r.end <= x.start or r.start >= x.end for x in redactions)
    ]
    redactions.sort(key=lambda r: r.start)
    parts: list[str] = []
    cursor = 0
    for r in redactions:
        parts.append(doc.text[cursor : r.start])
        parts.append(f"⟦REDACTED:{r.kind}⟧")
        cursor = r.end
    parts.append(doc.text[cursor:])
    return RedactedDoc(text="".join(parts), redactions=redactions)
