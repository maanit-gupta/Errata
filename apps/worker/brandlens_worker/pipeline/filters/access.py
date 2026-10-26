"""Accessibility (A-*, WCAG): reading grade and non-descriptive link text (SPEC §6.1)."""

from __future__ import annotations

import re

import textstat

from brandlens_worker import config
from brandlens_worker.pipeline.filters.base import cap_severity, pick_rule
from brandlens_worker.pipeline.types import Doc, Finding, Vault

# Readability formulas are meaningless on a one-line caption.
MIN_WORDS_FOR_GRADE = 60

_MD_LINK = re.compile(r"\[(?P<label>[^\]]{1,80})\]\((?P<url>[^)\s]+)\)")
_BARE_URL = re.compile(r"(?<![(\[<\"'=])\bhttps?://[^\s)>\]]+", re.IGNORECASE)
_VAGUE = re.compile(
    r"^(?:click here|here|this|this link|link|read more|more|learn more)$", re.IGNORECASE
)


def check_access(doc: Doc, vault: Vault) -> list[Finding]:
    text = doc.text
    findings: list[Finding] = []

    rule = pick_rule(vault.rules_for("access"), "grade", "readab")
    if rule and doc.word_count >= MIN_WORDS_FOR_GRADE:
        grade = float(textstat.flesch_kincaid_grade(text))
        if grade > config.READING_GRADE_TARGET:
            first = doc.segments[0] if doc.segments else None
            start, end = (first.start, first.end) if first else (0, len(text))
            findings.append(
                Finding(
                    dimension="access",
                    start=start,
                    end=end,
                    severity=cap_severity("access", "suggestion"),
                    explanation=(
                        f"Reads at grade {grade:.1f}; the target for retail audiences is "
                        f"{config.READING_GRADE_TARGET} or below ({rule.code}: {rule.title})."
                    ),
                    rule_id=rule.id,
                    codes=[rule.code],
                )
            )

    for m in _MD_LINK.finditer(text):
        if _VAGUE.match(m.group("label").strip()):
            findings.append(
                _link(
                    m.start("label"),
                    m.end("label"),
                    f'Link text "{m.group("label")}" doesn\'t say where it goes.',
                )
            )
    for m in _BARE_URL.finditer(text):
        findings.append(
            _link(
                m.start(),
                m.end(),
                "A bare URL is read out character by character; use descriptive link text.",
            )
        )
    return findings


def _link(start: int, end: int, why: str) -> Finding:
    return Finding(
        dimension="access",
        start=start,
        end=end,
        severity=cap_severity("access", "warning"),
        explanation=f"{why} (WCAG 2.4.4 Link Purpose)",
        wcag_ref="2.4.4",
        codes=["WCAG 2.4.4"],
    )
