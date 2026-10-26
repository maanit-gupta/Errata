"""scripts/demo_data.py (cloud seed) must match supabase/seed.sql (local seed)."""

import re
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

import demo_data as d  # noqa: E402
import seed_demo  # noqa: E402

# Adjacent SQL string literals ('a' \n 'b') concatenate; collapse them so long bodies compare.
SEED_SQL = re.sub(r"'\s*\n\s*'", "", (ROOT / "supabase" / "seed.sql").read_text())


def _sql(text: str) -> str:
    return text.replace("'", "''")


def test_users_match_seed_sql() -> None:
    assert d.DEMO_PASSWORD in SEED_SQL
    for user_id, email, display_name, role, kind in d.USERS:
        assert user_id in SEED_SQL and f"'{email}'" in SEED_SQL
        assert _sql(display_name) in SEED_SQL
        membership = f"'{user_id}', '{role}', " + (f"'{kind}'" if kind else "null")
        assert membership in SEED_SQL, membership


def test_org_and_campaigns_match_seed_sql() -> None:
    assert d.ORG_ID in SEED_SQL
    for c in d.CAMPAIGNS:
        for key in ("id", "name", "starts_on", "ends_on", "status"):
            assert f"'{c[key]}'" in SEED_SQL, (c["name"], key)


@pytest.mark.parametrize("fact", d.FACTS, ids=lambda f: f["code"])
def test_facts_match_seed_sql(fact: dict[str, Any]) -> None:
    for key in ("code", "kind", "statement"):
        assert f"'{_sql(fact[key])}'" in SEED_SQL, key
    for key in ("required_disclaimer", "valid_until"):
        if fact[key] is not None:
            assert f"'{_sql(fact[key])}'" in SEED_SQL, key


@pytest.mark.parametrize("card", d.RULE_CARDS, ids=lambda c: c["code"])
def test_rule_cards_match_seed_sql(card: dict[str, Any]) -> None:
    for key in ("code", "title", "summary", "body", "severity"):
        assert _sql(card[key]) in SEED_SQL, key
    for ex in card["examples"]:
        assert ex["text"] in SEED_SQL


def test_spec_codes_present() -> None:
    assert {c["code"] for c in d.RULE_CARDS} == {"TV-02", "TV-04", "CL-03", "G-07", "VS-02", "A-01"}
    assert {f["code"] for f in d.FACTS} == {"F-048", "F-112", "E-19", "E-11"}


def test_check_target_refuses_wrong_url() -> None:
    msg = seed_demo.check_target("https://other.supabase.co", "https://mine.supabase.co", yes=True)
    assert msg is not None and "does not match" in msg


def test_check_target_requires_yes() -> None:
    msg = seed_demo.check_target("https://mine.supabase.co/", "https://MINE.supabase.co", yes=False)
    assert msg is not None and "--yes" in msg


def test_check_target_ok() -> None:
    url = "https://mine.supabase.co"
    assert seed_demo.check_target(url + "/", url, yes=True) is None
