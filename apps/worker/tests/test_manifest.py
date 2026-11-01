"""Hero 2 (unit): dependency extraction from the facts stage and the manifest hash mirror."""

from __future__ import annotations

import hashlib

from brandlens_worker.manifest import content_sha256, normalise_body
from brandlens_worker.pipeline.filters.facts import dependent_fact_ids
from brandlens_worker.pipeline.ingest import ingest
from tests.vault_fixture import HERO, paywise_vault

CORRECT = (
    "Join the Diwali Wealth Webinar on Oct 28 at 7 PM (online). 1% exit load within 365 days. "
    "3-yr historical CAGR 14.2% as of Q3 2026."
)


def deps(text: str) -> set[str]:
    return dependent_fact_ids(ingest("text", body=text), paywise_vault())


def test_correct_copy_depends_on_the_facts_it_states() -> None:
    assert deps(CORRECT) == {"fact-E-19", "fact-F-048", "fact-F-112"}


def test_unrelated_copy_depends_on_nothing() -> None:
    assert deps("Start a SIP this Diwali. Register now.") == set()


def test_other_campaign_facts_are_never_dependencies() -> None:
    # Oct 18 at Hall B is Navratri's E-11: out of scope for the Diwali campaign.
    assert "fact-E-11" not in deps(HERO)


def test_percentages_need_their_keywords() -> None:
    assert deps("Save 1% more with every SIP.") == set()  # 1% but not an exit load


def test_hash_mirror() -> None:
    body = "  Join the  Diwali\tWealth Webinar\n on Oct 28 at 7 PM.  "
    assert normalise_body(body) == "Join the Diwali Wealth Webinar on Oct 28 at 7 PM."
    assert content_sha256(body) == hashlib.sha256(normalise_body(body).encode()).hexdigest()
    assert content_sha256(None) == hashlib.sha256(b"").hexdigest()
    # Non-ASCII spaces are content, not whitespace to collapse (same as the SQL function).
    assert normalise_body("a  b") == "a  b"
