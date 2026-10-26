"""Terms (G-*): glossary casing, variants and banned terms via Aho-Corasick (SPEC §6.1)."""

from __future__ import annotations

import re

import ahocorasick

from brandlens_worker.pipeline.filters.base import cap_severity, is_word_char
from brandlens_worker.pipeline.types import Doc, Finding, GlossaryTerm, Vault

_SUFFIX = re.compile(r"(?:'s|’s|s)?")


def check_terms(doc: Doc, vault: Vault) -> list[Finding]:
    if not vault.glossary:
        return []
    auto = ahocorasick.Automaton()
    for term in vault.glossary:
        for surface in {term.preferred, *term.variants}:
            key = surface.lower()
            if not key.strip():
                continue
            entries = auto.get(key, []) if key in auto else []
            auto.add_word(key, [*entries, (term, surface)])
    auto.make_automaton()

    lower = doc.text.lower()
    candidates: list[tuple[int, int, GlossaryTerm, str]] = []
    for end_idx, entries in auto.iter(lower):
        for term, surface in entries:
            start = end_idx - len(surface) + 1
            end = end_idx + 1
            # Token boundary on the left; allow possessive/plural on the right.
            if start > 0 and is_word_char(doc.text[start - 1]):
                continue
            suffix = _SUFFIX.match(doc.text, end)
            tail = suffix.end() if suffix else end
            if tail < len(doc.text) and is_word_char(doc.text[tail]):
                continue
            candidates.append((start, end, term, surface))

    # Longest match wins ("Paywise app" over "Paywise").
    candidates.sort(key=lambda c: (c[0], -(c[1] - c[0])))
    findings: list[Finding] = []
    last_end = -1
    for start, end, term, surface in candidates:
        if start < last_end:
            continue
        found = doc.text[start:end]
        finding = _judge(found, start, end, term, surface, vault)
        if finding:
            findings.append(finding)
            last_end = end
    return findings


def _judge(
    found: str, start: int, end: int, term: GlossaryTerm, surface: str, vault: Vault
) -> Finding | None:
    rule = vault.rule(term.code)
    if rule is None:
        return None  # nothing approved to cite; never emit uncited findings
    is_variant = surface.lower() != term.preferred.lower()

    if term.banned:
        severity, why = "blocker", f'"{found}" is a banned term.'
    elif is_variant:
        severity, why = rule.severity, f'Write "{term.preferred}", not "{found}".'
    elif term.case_sensitive and found != term.preferred:
        severity, why = rule.severity, f'"{found}" is cased wrongly; write "{term.preferred}".'
    else:
        return None

    return Finding(
        dimension="terms",
        start=start,
        end=end,
        severity=cap_severity("terms", severity),  # type: ignore[arg-type]
        explanation=f"{why} ({term.code}: {rule.title})",
        rule_id=rule.id,
        codes=[rule.code],
        rewrite=None if term.banned else term.preferred,
    )
