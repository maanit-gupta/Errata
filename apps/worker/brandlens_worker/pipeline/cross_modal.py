"""Cross-modal reconciliation (Round 3 extra, Hero 4): the dates, times and percentages a post
states on its different surfaces must agree.

Surfaces: the **checked document** (OCR text of an image, or the body of a text draft) and the
optional **caption** (image posts) and **landing-page text** from the intent. Entities come from
the same extractor the facts filter uses (`filters/entities.py`), so "Oct 28", "28 October" and
"28/10" are one date, and "7 PM" equals "19:00".

Every conflict is anchored on a vault fact: an in-scope, unexpired fact with an attribute of that
kind (date, time, percent) found on at least one surface, or the only such fact in scope. That fact
is cited, so the finding passes invariant 1; with no applicable fact there is no finding (an
uncited conflict is never shown, CLAUDE.md invariant 1). Percentages count only next to the fact's
own keywords (e.g. "exit load", "CAGR"), so an exit load and a return rate don't clash.

Deterministic: no model. The finding is anchored on the checked document and names the other
surface's span in `counterpart` (surface, offsets in that surface, quote).
"""

from __future__ import annotations

from dataclasses import dataclass

from brandlens_worker.pipeline.filters.base import cap_severity
from brandlens_worker.pipeline.filters.entities import Entity, extract
from brandlens_worker.pipeline.filters.facts import KEYWORD_WINDOW, Attr, fact_attrs
from brandlens_worker.pipeline.types import Doc, Fact, Finding, Vault

CHECK_VERSION = "cross_modal@1"
KINDS = ("date", "time", "percent")
LABEL = {"document": "the image text", "caption": "the caption", "landing_page": "the landing page"}


@dataclass(frozen=True)
class Surface:
    name: str  # document | caption | landing_page
    text: str


def _same(e: Entity, a: Attr) -> bool:
    if e.kind != a.kind:
        return False
    if e.kind == "percent":
        return abs(float(e.value) - float(a.value)) < 1e-9  # type: ignore[arg-type]
    return e.value == a.value


def _about(text: str, e: Entity, a: Attr) -> bool:
    """Percentages must sit next to the fact's keywords; dates and times are about the event."""
    if a.kind != "percent" or not a.keywords:
        return True
    window = text[max(0, e.start - KEYWORD_WINDOW) : e.end + KEYWORD_WINDOW].lower()
    return any(k in window for k in a.keywords)


def _in_scope(vault: Vault) -> list[Fact]:
    return [
        f
        for f in vault.facts
        if vault.in_scope(f) and (f.valid_until is None or f.valid_until >= vault.now)
    ]


def check_cross_modal(doc: Doc, others: list[Surface], vault: Vault) -> list[Finding]:
    """Conflicts between the checked document and each other surface: one finding per fact and
    surface."""
    main = Surface("document", doc.text)
    surfaces = [s for s in others if s.text and s.text.strip()]
    if not main.text.strip() or not surfaces:
        return []
    ents = {s.name: extract(s.text) for s in [main, *surfaces]}
    facts = _in_scope(vault)
    out: list[Finding] = []
    for other in surfaces:
        for kind in KINDS:
            attrs = [(f, a) for f in facts for a in fact_attrs(f) if a.kind == kind]
            if not attrs:
                continue
            for fact, attr in _applicable(attrs, main, other, ents):
                a_ents = [
                    e for e in ents[main.name] if e.kind == kind and _about(main.text, e, attr)
                ]
                b_ents = [
                    e for e in ents[other.name] if e.kind == kind and _about(other.text, e, attr)
                ]
                if not a_ents or not b_ents:
                    continue
                a_vals = {_key(e) for e in a_ents}
                b_vals = {_key(e) for e in b_ents}
                if a_vals & b_vals:
                    continue  # the surfaces share the value: consistent
                out.append(_finding(doc, main, other, a_ents[0], b_ents[0], fact, attr, vault))
    return out


def _key(e: Entity) -> object:
    return round(float(e.value), 6) if e.kind == "percent" else e.value  # type: ignore[arg-type]


def _applicable(
    attrs: list[tuple[Fact, Attr]], main: Surface, other: Surface, ents: dict[str, list[Entity]]
) -> list[tuple[Fact, Attr]]:
    """The fact(s) a conflict of this kind is about: those whose value appears on either surface,
    else the only fact of that kind in scope."""
    seen = [
        (f, a) for f, a in attrs if any(_same(e, a) for s in (main, other) for e in ents[s.name])
    ]
    if seen:
        # One finding per fact, even if it has the same kind twice.
        uniq: dict[str, tuple[Fact, Attr]] = {}
        for f, a in seen:
            uniq.setdefault(f.id, (f, a))
        return list(uniq.values())
    return attrs if len({f.id for f, _ in attrs}) == 1 else []


def _finding(
    doc: Doc,
    main: Surface,
    other: Surface,
    a: Entity,
    b: Entity,
    fact: Fact,
    attr: Attr,
    vault: Vault,
) -> Finding:
    right = (
        "the vault"
        if not (_same(a, attr) or _same(b, attr))
        else (LABEL[main.name] if _same(a, attr) else LABEL[other.name])
    )
    explanation = (
        f"{LABEL[main.name].capitalize()} says “{a.text}” but {LABEL[other.name]} says "
        f"“{b.text}”. {fact.code} ({fact.statement}) is the approved value; {right} matches it. "
        "Make every surface of the post say the same thing."
    )
    return Finding(
        dimension="facts",
        start=a.start,
        end=a.end,
        severity=cap_severity("facts", "blocker"),
        explanation=explanation,
        fact_id=fact.id,
        codes=[fact.code],
        source="deterministic",
        confidence=1.0,
        bbox=doc.bbox_for(a.start, a.end),
        check=CHECK_VERSION,
        counterpart={"surface": other.name, "start": b.start, "end": b.end, "quote": b.text},
    )
