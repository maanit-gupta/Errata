"""Tone heuristics (TV-*): exclamation density, shouting, and phrasing the tone rules ban.

Whether the voice *matches* is the LLM's job (SPEC §6.1); these are the mechanical tells.
"""

from __future__ import annotations

import re

from brandlens_worker import config
from brandlens_worker.pipeline.filters.base import cap_severity, on_word_boundary, pick_rule
from brandlens_worker.pipeline.types import Doc, Finding, Rule, Vault

_QUOTED = re.compile(r"[\"“]([^\"”]{3,40})[\"”]")
MIN_EXCLAMATIONS = 2  # one "!" in a short caption isn't a pattern


def banned_phrases(rule: Rule) -> list[str]:
    """Short quoted phrases in a tone rule's body ('no superlatives like "best ever"') plus its
    don't-examples' exclamations are treated as banned phrasing."""
    phrases = [p.strip().rstrip("!.").strip() for p in _QUOTED.findall(rule.body)]
    return [p for p in phrases if p and len(p.split()) <= 4]


def check_tone(doc: Doc, vault: Vault) -> list[Finding]:
    text = doc.text
    tone_rules = vault.rules_for("tone")
    if not tone_rules:
        return []
    findings: list[Finding] = []
    lower = text.lower()

    # Banned phrasing
    for rule in tone_rules:
        for phrase in banned_phrases(rule):
            for m in re.finditer(re.escape(phrase.lower()), lower):
                if on_word_boundary(text, m.start(), m.end()):
                    findings.append(
                        Finding(
                            dimension="tone",
                            start=m.start(),
                            end=m.end(),
                            severity=cap_severity("tone", "warning"),
                            explanation=(
                                f'"{text[m.start() : m.end()]}" is phrasing {rule.code} '
                                f"rules out ({rule.title})."
                            ),
                            rule_id=rule.id,
                            codes=[rule.code],
                        )
                    )

    hype = pick_rule(tone_rules, "exclamation", "hype")
    words = max(doc.word_count, 1)
    bangs = [m for m in re.finditer(r"!+", text)]
    if (
        hype
        and len(bangs) >= MIN_EXCLAMATIONS
        and len(bangs) / words > 1 / config.EXCLAMATION_PER_WORDS
    ):
        first, last = bangs[0], bangs[-1]
        start = text.rfind(".", 0, first.start()) + 1
        findings.append(
            Finding(
                dimension="tone",
                start=start + (len(text[start:]) - len(text[start:].lstrip())),
                end=last.end(),
                severity=cap_severity("tone", "suggestion"),
                explanation=(
                    f"{len(bangs)} exclamation marks in {words} words reads as hype "
                    f"({hype.code}: {hype.title})."
                ),
                rule_id=hype.id,
                codes=[hype.code],
            )
        )

    letters = [c for c in text if c.isalpha()]
    caps_words = [m for m in re.finditer(r"\b[A-Z]{4,}\b", text) if m.group() not in ("PAYWISE",)]
    if hype and letters and caps_words:
        ratio = sum(1 for c in letters if c.isupper()) / len(letters)
        if ratio > config.CAPS_RATIO_MAX:
            findings.append(
                Finding(
                    dimension="tone",
                    start=caps_words[0].start(),
                    end=caps_words[-1].end(),
                    severity=cap_severity("tone", "suggestion"),
                    explanation=(
                        f"{ratio:.0%} capital letters reads as shouting "
                        f"({hype.code}: {hype.title})."
                    ),
                    rule_id=hype.id,
                    codes=[hype.code],
                )
            )
    return findings
