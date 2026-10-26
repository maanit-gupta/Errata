"""Stage 3: deterministic filters (SPEC §6.1). Anything checkable without a model is checked here
and never delegated to the LLM (invariant 3). Every finding cites a rule, fact or WCAG ref."""

from __future__ import annotations

from brandlens_worker.pipeline.filters.access import check_access
from brandlens_worker.pipeline.filters.claims import check_claims
from brandlens_worker.pipeline.filters.facts import check_facts
from brandlens_worker.pipeline.filters.terms import check_terms
from brandlens_worker.pipeline.filters.tone import check_tone
from brandlens_worker.pipeline.types import Doc, Finding, Vault


def run_filters(doc: Doc, vault: Vault) -> list[Finding]:
    findings = [
        *check_terms(doc, vault),
        *check_facts(doc, vault),
        *check_claims(doc, vault),
        *check_tone(doc, vault),
        *check_access(doc, vault),
    ]
    # Invariant 1: never emit an uncited finding.
    return sorted((f for f in findings if f.cited), key=lambda f: (f.start, f.end))
