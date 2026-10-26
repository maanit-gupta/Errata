"""Facts (F-*, E-*): match draft entities against the Fact Vault, by campaign (SPEC §6.1).

- a value that conflicts with an in-scope fact of the same kind → blocker citing that fact
- a value that matches a fact from a *different* campaign → blocker: context bleed
- an in-scope fact referenced after it expired → warning
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from brandlens_worker.pipeline.filters.base import cap_severity
from brandlens_worker.pipeline.filters.entities import Entity, extract, format_date, format_time
from brandlens_worker.pipeline.types import Doc, Fact, Finding, Vault

KEYWORD_WINDOW = 40
_CLUSTER_GAP = re.compile(
    r"^\s*(?:,|at|in|on|@|—|–|-|from|by)?\s*(?:,|at|in|on)?\s*$", re.IGNORECASE
)
_GENERIC_WORDS = {"online", "event", "campaign", "about", "their", "there", "which"}


@dataclass(frozen=True)
class Attr:
    kind: str  # date | time | percent | money | venue
    value: object
    keywords: tuple[str, ...] = ()


def _keywords(key: str) -> tuple[str, ...]:
    if "exit_load" in key:
        return ("exit load",)
    if "cagr" in key or "return" in key:
        return ("cagr", "return", "growth")
    if "fee" in key or "charge" in key:
        return ("fee", "charge")
    words = [w for w in re.split(r"[_\d]+", key) if w and w not in ("pct", "inr", "amount")]
    return (" ".join(words),) if words else ()


def fact_attrs(fact: Fact) -> list[Attr]:
    attrs: list[Attr] = []
    for key, val in (fact.value or {}).items():
        k = key.lower()
        if k.endswith("pct") and isinstance(val, int | float):
            attrs.append(Attr("percent", float(val), _keywords(k)))
        elif (k.endswith("_inr") or k in ("amount", "price", "fee")) and isinstance(
            val, int | float
        ):
            attrs.append(Attr("money", float(val), _keywords(k)))
        elif k == "date" and isinstance(val, str):
            try:
                d = date.fromisoformat(val)
            except ValueError:
                continue
            attrs.append(Attr("date", (d.month, d.day)))
        elif k == "time" and isinstance(val, str) and re.fullmatch(r"\d{2}:\d{2}", val):
            attrs.append(Attr("time", val))
        elif k == "venue" and isinstance(val, str):
            attrs.append(Attr("venue", val.lower()))
    return attrs


def _venue_matches(entity_value: str, fact_value: str) -> bool:
    parts = {p.strip() for p in fact_value.split(",")} | {fact_value}
    return entity_value in parts or entity_value in fact_value


def _matches(entity: Entity, attr: Attr) -> bool:
    if entity.kind != attr.kind:
        return False
    if entity.kind == "venue":
        return _venue_matches(str(entity.value), str(attr.value))
    if entity.kind in ("percent", "money"):
        return abs(float(entity.value) - float(attr.value)) < 1e-9  # type: ignore[arg-type]
    return entity.value == attr.value


def _near(text: str, entity: Entity, keywords: tuple[str, ...]) -> bool:
    window = text[max(0, entity.start - KEYWORD_WINDOW) : entity.end + KEYWORD_WINDOW].lower()
    return any(k in window for k in keywords)


def _expired(fact: Fact, vault: Vault) -> bool:
    return fact.valid_until is not None and fact.valid_until < vault.now


def _event_words(fact: Fact) -> set[str]:
    name = str((fact.value or {}).get("name") or fact.statement.split(":")[0])
    return {
        w for w in re.findall(r"[a-z]+", name.lower()) if len(w) >= 5 and w not in _GENERIC_WORDS
    }


@dataclass
class Mention:
    """An in-scope fact the draft mentions with the right value (used by the claims filter)."""

    fact: Fact
    start: int
    end: int


@dataclass
class _Problem:
    entity: Entity
    target: Fact | None  # the in-scope fact it should match
    bleed: Fact | None  # the out-of-scope fact it does match
    extra: list[Entity] = field(default_factory=list)


def mentioned_facts(doc: Doc, vault: Vault) -> list[Mention]:
    lower = doc.text.lower()
    out: list[Mention] = []
    for e in extract(doc.text):
        if e.kind not in ("percent", "money"):
            continue
        for f in vault.facts:
            if vault.in_scope(f) and any(
                _matches(e, a) and _near(lower, e, a.keywords) for a in fact_attrs(f)
            ):
                out.append(Mention(f, e.start, e.end))
    return out


def check_facts(doc: Doc, vault: Vault) -> list[Finding]:
    text = doc.text
    lower = text.lower()
    entities = extract(text)
    in_scope = [f for f in vault.facts if vault.in_scope(f)]
    out_scope = [f for f in vault.facts if not vault.in_scope(f)]
    findings: list[Finding] = []

    # Percentages and money: identify the fact by the keywords around the number.
    for e in (x for x in entities if x.kind in ("percent", "money")):
        candidates = [
            (f, a)
            for f in in_scope
            for a in fact_attrs(f)
            if a.kind == e.kind and _near(lower, e, a.keywords)
        ]
        if candidates:
            ok = [(f, a) for f, a in candidates if _matches(e, a)]
            if ok:
                f = ok[0][0]
                if _expired(f, vault):
                    findings.append(_expired_finding(e.start, e.end, f))
                continue
            fact, attr = candidates[0]
            start, end = _extend_to_keyword(text, e, attr.keywords)
            findings.append(
                Finding(
                    dimension="facts",
                    start=start,
                    end=end,
                    severity=cap_severity("facts", "blocker"),
                    explanation=(f'"{text[start:end]}" contradicts {fact.code}: {fact.statement}.'),
                    fact_id=fact.id,
                    codes=[fact.code],
                    rewrite=text[start:end].replace(e.text, _format_number(attr.value, e), 1),
                )
            )
            continue
        bleed = next(
            (
                f
                for f in out_scope
                for a in fact_attrs(f)
                if _matches(e, a) and _near(lower, e, a.keywords)
            ),
            None,
        )
        if bleed:
            findings.append(_bleed_finding(text, [e], None, bleed, vault))

    # Event details: dates, times and venues.
    events = [f for f in in_scope if f.kind == "event"]
    referenced = [f for f in events if _event_words(f) & set(re.findall(r"[a-z]+", lower))]
    detail_entities = [x for x in entities if x.kind in ("date", "time", "venue")]
    if not referenced and len(events) == 1 and detail_entities:
        referenced = events  # one event in the campaign: details must be about it
    target = referenced[0] if referenced else None

    problems: list[_Problem] = []
    for e in detail_entities:
        tattrs = [a for a in fact_attrs(target) if a.kind == e.kind] if target else []
        if tattrs and any(_matches(e, a) for a in tattrs):
            if target and _expired(target, vault):
                findings.append(_expired_finding(e.start, e.end, target))
            continue
        bleed = next((f for f in out_scope for a in fact_attrs(f) if _matches(e, a)), None)
        if tattrs or bleed:
            problems.append(_Problem(e, target if tattrs else None, bleed))

    for cluster in _cluster(text, problems):
        ents = [p.entity for p in cluster]
        tgt = next((p.target for p in cluster if p.target), None)
        bleed = next((p.bleed for p in cluster if p.bleed), None)
        if bleed:
            findings.append(_bleed_finding(text, ents, tgt, bleed, vault))
        elif tgt:
            start, end = ents[0].start, ents[-1].end
            findings.append(
                Finding(
                    dimension="facts",
                    start=start,
                    end=end,
                    severity=cap_severity("facts", "blocker"),
                    explanation=f'"{text[start:end]}" doesn\'t match {tgt.code}: {tgt.statement}.',
                    fact_id=tgt.id,
                    codes=[tgt.code],
                    rewrite=_event_rewrite(tgt, ents),
                )
            )
    return findings


def _cluster(text: str, problems: list[_Problem]) -> list[list[_Problem]]:
    clusters: list[list[_Problem]] = []
    for p in sorted(problems, key=lambda p: p.entity.start):
        if clusters:
            prev = clusters[-1][-1].entity
            gap = text[prev.end : p.entity.start]
            if len(gap) <= 6 and _CLUSTER_GAP.match(gap):
                clusters[-1].append(p)
                continue
        clusters.append([p])
    return clusters


def _bleed_finding(
    text: str, ents: list[Entity], target: Fact | None, bleed: Fact, vault: Vault
) -> Finding:
    start, end = ents[0].start, ents[-1].end
    quote = text[start:end]
    campaign = f'campaign "{bleed.campaign_name}"' if bleed.campaign_name else "another campaign"
    why = (
        f'"{quote}" belongs to {bleed.code} ({bleed.statement}) from {campaign}, '
        f'not "{vault.campaign_name}".'
    )
    if target:
        why += f" This campaign's fact is {target.code}: {target.statement}."
    primary = target or bleed
    return Finding(
        dimension="facts",
        start=start,
        end=end,
        severity=cap_severity("facts", "blocker"),
        explanation=why,
        fact_id=primary.id,
        codes=[primary.code] + ([bleed.code] if target else []),
        rewrite=_event_rewrite(target, ents) if target else None,
    )


def _event_rewrite(fact: Fact, ents: list[Entity]) -> str:
    attrs = {a.kind: a.value for a in fact_attrs(fact)}
    kinds = {e.kind for e in ents}
    parts: list[str] = []
    date_ent = next((e for e in ents if e.kind == "date"), None)
    if "date" in attrs:
        month_day: tuple[int, int] = attrs["date"]  # type: ignore[assignment]
        parts.append(
            format_date(month_day[0], month_day[1], date_ent.text if date_ent else "Oct 1")
        )
    if "time" in attrs and ("time" in kinds or "date" in kinds):
        parts.append(f"{format_time(str(attrs['time']))} IST")
    rewrite = ", ".join(parts)
    if "venue" in attrs and ("venue" in kinds or "date" in kinds):
        venue = str(attrs["venue"])
        rewrite = f"{rewrite} ({venue})" if rewrite else venue
    return rewrite


def _extend_to_keyword(text: str, e: Entity, keywords: tuple[str, ...]) -> tuple[int, int]:
    after = text[e.end : e.end + 24].lower()
    for k in keywords:
        idx = after.find(k)
        if 0 <= idx <= 3:
            return e.start, e.end + idx + len(k)
    return e.start, e.end


def _format_number(value: object, e: Entity) -> str:
    num = float(value)  # type: ignore[arg-type]
    shown = f"{num:g}"
    if e.kind == "percent":
        return f"{shown}%"
    m = re.match(r"(?:₹|Rs\.?|INR)\s?", e.text, re.IGNORECASE)
    prefix = m.group() if m else "₹"
    return f"{prefix}{shown}"


def _expired_finding(start: int, end: int, fact: Fact) -> Finding:
    until = fact.valid_until.date().isoformat() if fact.valid_until else "?"
    return Finding(
        dimension="facts",
        start=start,
        end=end,
        severity=cap_severity("facts", "warning"),
        explanation=f"{fact.code} expired on {until}: {fact.statement}. Check it's still current.",
        fact_id=fact.id,
        codes=[fact.code],
    )
