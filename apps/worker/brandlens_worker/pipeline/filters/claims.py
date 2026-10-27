"""Claims (CL-*): guarantee/superlative lexicon and missing required disclaimers (SPEC §6.1)."""

from __future__ import annotations

import re

from brandlens_worker.pipeline.filters.base import cap_severity, pick_rule
from brandlens_worker.pipeline.filters.facts import Mention, mentioned_facts
from brandlens_worker.pipeline.types import Doc, Fact, Finding, Rule, Vault

LEXICON = re.compile(
    # "Rest assured, ..." reassures the reader; it promises nothing about returns.
    r"\b(?:(?<!rest )assured|guaranteed?|risk[- ]free|no[- ]risk|100% safe|zero risk|best returns|"
    r"fixed returns?|sure[- ]shot|double your money)\b|#1\b|\block(?:ed)? in\s+\d+(?:\.\d+)?%",
    re.IGNORECASE,
)
# Grow a hit to the whole claim: "lock in 14.2% assured annual returns".
PHRASE = re.compile(
    r"(?:\block(?:ed)?\s+in\s+)?(?:\d+(?:\.\d+)?\s?%\s+)?(?:[a-z-]+\s+){0,1}"
    r"(?:assured|guaranteed?|risk[- ]free|fixed|sure[- ]shot)(?:\s+[a-z-]+){0,2}?\s+returns?\b",
    re.IGNORECASE,
)
MARKET_LINKED = re.compile(
    r"\b(?:sip|mutual funds?|funds?|returns?|nav|equity|equities|stocks?|shares?|market|cagr|"
    r"invest(?:ing|ment|ments)?|portfolio)\b",
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def check_claims(doc: Doc, vault: Vault) -> list[Finding]:
    text = doc.text
    claims_rules = vault.rules_for("claims")
    findings: list[Finding] = []

    rule = pick_rule(claims_rules, "guarantee", "assured")
    if rule and MARKET_LINKED.search(text):
        spans: list[tuple[int, int]] = []
        for m in LEXICON.finditer(text):
            start, end = m.start(), m.end()
            for p in PHRASE.finditer(text):
                if p.start() <= start < p.end():
                    start, end = min(start, p.start()), max(end, p.end())
            if spans and start <= spans[-1][1]:
                spans[-1] = (spans[-1][0], max(spans[-1][1], end))
            else:
                spans.append((start, end))
        for start, end in spans:
            findings.append(_claim(text, start, end, rule))

    # Required disclaimers: a fact that carries one is mentioned but the disclaimer is absent.
    norm_text = _norm(text)
    for mention in _dedupe(mentioned_facts(doc, vault)):
        fact = mention.fact
        if not fact.required_disclaimer or _norm(fact.required_disclaimer) in norm_text:
            continue
        merged = next((f for f in findings if f.start <= mention.start < f.end), None)
        if merged:
            _attach_disclaimer(merged, fact)
        else:
            findings.append(_disclaimer(text, mention, fact, rule))
    return findings


def _dedupe(mentions: list[Mention]) -> list[Mention]:
    seen: set[str] = set()
    out = []
    for m in mentions:
        if m.fact.id not in seen:
            seen.add(m.fact.id)
            out.append(m)
    return out


def _claim(text: str, start: int, end: int, rule: Rule) -> Finding:
    quote = text[start:end]
    return Finding(
        dimension="claims",
        start=start,
        end=end,
        severity=cap_severity("claims", rule.severity),
        explanation=(
            f'"{quote}" presents a return as certain on a market-linked product '
            f"({rule.code}: {rule.title})."
        ),
        rule_id=rule.id,
        codes=[rule.code],
    )


def _attach_disclaimer(finding: Finding, fact: Fact) -> None:
    """Merge the disclaimer check into the overlapping claims finding (one finding, both cited)."""
    finding.fact_id = fact.id
    finding.codes.append(fact.code)
    finding.explanation += (
        f" It also quotes {fact.code} ({fact.statement}) without the required disclaimer."
    )
    finding.rewrite = _historical_rewrite(fact)


def _historical_rewrite(fact: Fact) -> str:
    v = fact.value or {}
    pct = next((val for k, val in v.items() if k.endswith("pct")), None)
    as_of = v.get("as_of")
    scheme = v.get("scheme")
    figure = f"{pct:g}%" if isinstance(pct, int | float) else "the figure"
    bits = [
        f"{scheme} " if scheme else "",
        f"3-yr historical CAGR {figure}" if "cagr" in str(v) else f"historical {figure}",
    ]
    head = "".join(bits) + (f" (as of {as_of})" if as_of else "")
    return f"{head}. {fact.required_disclaimer}"


def _disclaimer(text: str, mention: Mention, fact: Fact, rule: Rule | None) -> Finding:
    return Finding(
        dimension="claims",
        start=mention.start,
        end=mention.end,
        severity=cap_severity("claims", "blocker"),
        explanation=(
            f"Quotes {fact.code} ({fact.statement}) without its required disclaimer: "
            f'"{fact.required_disclaimer}"'
        ),
        fact_id=fact.id,
        rule_id=rule.id if rule else None,
        codes=[fact.code] + ([rule.code] if rule else []),
        rewrite=f"{text[mention.start : mention.end]} ({fact.required_disclaimer})",
    )
