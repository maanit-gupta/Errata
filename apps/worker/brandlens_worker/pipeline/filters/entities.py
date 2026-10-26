"""Entity extraction for the facts filter: dates, times, percentages, money and venues (SPEC §6.1).

Deliberately small and regex-based: deterministic, explainable, testable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

EntityKind = Literal["date", "time", "percent", "money", "venue"]

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}  # fmt: skip
_MONTH = (
    r"(?P<mon>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
    r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_DAY = r"(?P<day>[0-3]?\d)(?:st|nd|rd|th)?"

DATE_PATTERNS = [
    re.compile(rf"\b{_MONTH}\.?\s+{_DAY}\b(?!\s*%)", re.IGNORECASE),  # Oct 18, October 18th
    re.compile(rf"\b{_DAY}\s+{_MONTH}\b\.?", re.IGNORECASE),  # 18 October
    re.compile(r"\b(?!24/7\b)(?P<day>[0-3]?\d)/(?P<mnum>[01]?\d)(?:/\d{2,4})?\b"),  # 18/10(/2026)
    re.compile(r"\b20\d\d-(?P<mnum>[01]\d)-(?P<day>[0-3]\d)\b"),  # 2026-10-18
]
TIME = re.compile(
    r"\b(?P<h>[01]?\d|2[0-3])(?::(?P<m>[0-5]\d))?\s?(?P<ampm>[ap]\.?m\.?)(?:\s?IST)?\b"
    r"|\b(?P<h24>[01]\d|2[0-3]):(?P<m24>[0-5]\d)(?:\s?(?:hrs|IST))?\b",
    re.IGNORECASE,
)
PERCENT = re.compile(r"(?<![\d.])(?P<num>\d{1,3}(?:\.\d+)?)\s?%")
MONEY = re.compile(r"(?:₹|\bRs\.?|\bINR)\s?(?P<num>\d[\d,]*(?:\.\d+)?)", re.IGNORECASE)

CITIES = [
    "Mumbai", "Delhi", "New Delhi", "Bengaluru", "Bangalore", "Chennai", "Kolkata", "Hyderabad",
    "Pune", "Ahmedabad", "Jaipur", "Chandigarh", "Lucknow", "Kochi", "Indore", "Gurugram", "Noida",
]  # fmt: skip
VENUE = re.compile(
    r"\b(?:Hall\s+[A-Z0-9]\b|Auditorium(?:\s+[A-Z0-9]\b)?|Room\s+\d+\b|Online\b|online\b|"
    + "|".join(re.escape(c) + r"\b" for c in sorted(CITIES, key=len, reverse=True))
    + ")"
)


@dataclass(frozen=True)
class Entity:
    kind: EntityKind
    start: int
    end: int
    text: str
    value: object  # date: (month, day); time: "HH:MM"; percent/money: float; venue: lowercased str


def _month(m: re.Match[str]) -> int | None:
    groups = m.groupdict()
    if groups.get("mon"):
        return MONTHS.get(groups["mon"].lower()[:3])
    if groups.get("mnum"):
        n = int(groups["mnum"])
        return n if 1 <= n <= 12 else None
    return None


def extract(text: str) -> list[Entity]:
    found: list[Entity] = []
    taken: list[tuple[int, int]] = []

    def add(kind: EntityKind, start: int, end: int, value: object) -> None:
        if any(start < e and end > s for s, e in taken):
            return
        taken.append((start, end))
        found.append(Entity(kind, start, end, text[start:end], value))

    for pattern in DATE_PATTERNS:
        for m in pattern.finditer(text):
            month, day = _month(m), int(m.group("day"))
            if month and 1 <= day <= 31:
                add("date", m.start(), m.end(), (month, day))
    for m in TIME.finditer(text):
        if m.group("h24"):
            hh, mm = int(m.group("h24")), int(m.group("m24"))
        else:
            hh, mm = int(m.group("h")) % 12, int(m.group("m") or 0)
            if m.group("ampm").lower().startswith("p"):
                hh += 12
        add("time", m.start(), m.end(), f"{hh:02d}:{mm:02d}")
    for m in PERCENT.finditer(text):
        add("percent", m.start(), m.end(), float(m.group("num")))
    for m in MONEY.finditer(text):
        add("money", m.start(), m.end(), float(m.group("num").replace(",", "")))
    for m in VENUE.finditer(text):
        add("venue", m.start(), m.end(), m.group().lower())
    return sorted(found, key=lambda e: e.start)


def format_date(month: int, day: int, like: str) -> str:
    """Format a date in the same style as the draft's text (e.g. "Oct 18" → "Oct 28")."""
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    full = ["January", "February", "March", "April", "May", "June", "July", "August",
            "September", "October", "November", "December"]  # fmt: skip
    if re.match(r"^\d", like):
        if "/" in like:
            return f"{day}/{month}"
        return f"{day} {full[month - 1] if len(like.split()[-1]) > 4 else names[month - 1]}"
    word = like.split()[0].rstrip(".")
    return f"{full[month - 1] if len(word) > 4 else names[month - 1]} {day}"


def format_time(hhmm: str) -> str:
    hh, mm = (int(x) for x in hhmm.split(":"))
    suffix = "AM" if hh < 12 else "PM"
    return f"{hh % 12 or 12}:{mm:02d} {suffix}"
