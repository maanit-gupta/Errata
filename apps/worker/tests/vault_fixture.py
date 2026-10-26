"""An in-memory PayWise Vault built from scripts/demo_data.py (no DB)."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

import demo_data as d  # noqa: E402

from brandlens_worker.pipeline.types import Fact, GlossaryTerm, Rule, Vault  # noqa: E402

NOW = datetime.fromisoformat("2026-10-26T12:00:00+05:30")
CAMPAIGN_NAMES = {c["id"]: c["name"] for c in d.CAMPAIGNS}

HERO = (
    "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured "
    "annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!"
)


def paywise_vault(campaign_id: str = d.DIWALI, now: datetime = NOW) -> Vault:
    return Vault(
        campaign_id=campaign_id,
        campaign_name=CAMPAIGN_NAMES[campaign_id],
        rules=[
            Rule(
                id=f"rule-{c['code']}",
                code=c["code"],
                dimension=c["dimension"],
                title=c["title"],
                body=c["body"],
                severity=c["severity"],
                examples=c["examples"],
            )
            for c in d.RULE_CARDS
        ],
        facts=[
            Fact(
                id=f"fact-{f['code']}",
                code=f["code"],
                kind=f["kind"],
                statement=f["statement"],
                value=f["value"],
                campaign_id=f["campaign_id"],
                campaign_name=CAMPAIGN_NAMES.get(f["campaign_id"]) if f["campaign_id"] else None,
                required_disclaimer=f["required_disclaimer"],
                valid_until=datetime.fromisoformat(f["valid_until"]) if f["valid_until"] else None,
            )
            for f in d.FACTS
        ],
        glossary=[
            GlossaryTerm(
                code=g["code"],
                preferred=g["preferred"],
                variants=g["variants"],
                banned=g["banned"],
                case_sensitive=g["case_sensitive"],
            )
            for g in d.GLOSSARY
        ],
        now=now,
    )
