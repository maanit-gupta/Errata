"""PayWise demo data (SPEC §16), mirrored from `supabase/seed.sql`.

`seed.sql` loads this locally on `make db-reset`; `scripts/seed_demo.py` loads it into a cloud
project. `apps/worker/tests/test_demo_data.py` checks the two stay in sync. All fictional.
"""

from typing import Any

DEMO_PASSWORD = "PayWise-demo-2026"

ORG_ID = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
NAVRATRI = "20000000-0000-4000-8000-000000000002"

ORGANISATION: dict[str, Any] = {
    "id": ORG_ID,
    "name": "PayWise",
    "settings": {"locale": "en-IN", "tz": "Asia/Kolkata"},
}

CAMPAIGNS: list[dict[str, Any]] = [
    {
        "id": DIWALI,
        "org_id": ORG_ID,
        "name": "Diwali SIP 2026",
        "starts_on": "2026-10-10",
        "ends_on": "2026-11-15",
        "status": "active",
    },
    {
        "id": NAVRATRI,
        "org_id": ORG_ID,
        "name": "Navratri Savings 2026",
        "starts_on": "2026-09-22",
        "ends_on": "2026-10-19",
        "status": "ended",
    },
]

# (id, email, display_name, role, specialist_kind)
USERS: list[tuple[str, str, str, str, str | None]] = [
    (
        "10000000-0000-4000-8000-000000000001",
        "admin@paywise.demo",
        "Asha (Brand admin)",
        "brand_admin",
        None,
    ),
    (
        "10000000-0000-4000-8000-000000000002",
        "creator@paywise.demo",
        "Rohan (Creator)",
        "creator",
        None,
    ),
    (
        "10000000-0000-4000-8000-000000000003",
        "agency@paywise.demo",
        "Kiran (Agency)",
        "agency_creator",
        None,
    ),
    (
        "10000000-0000-4000-8000-000000000004",
        "manager@paywise.demo",
        "Meera (Manager)",
        "manager",
        None,
    ),
    (
        "10000000-0000-4000-8000-000000000005",
        "legal@paywise.demo",
        "Dev (Legal)",
        "specialist",
        "legal",
    ),
    (
        "10000000-0000-4000-8000-000000000006",
        "a11y@paywise.demo",
        "Noor (Accessibility)",
        "specialist",
        "a11y",
    ),
]

GLOSSARY: list[dict[str, Any]] = [
    {
        "org_id": ORG_ID,
        "code": "G-07",
        "preferred": "PayWise",
        "variants": [
            "Paywise",
            "paywise",
            "PAYWISE",
            "Pay Wise",
            "Paywise app",
            "PayWise app",
        ],
        "banned": False,
        "case_sensitive": True,
        "note": (
            'Always camel-cased "PayWise". '
            'Never "Paywise app": PayWise is the brand, not just an app.'
        ),
    }
]

FACTS: list[dict[str, Any]] = [
    {
        "org_id": ORG_ID,
        "campaign_id": None,
        "code": "F-048",
        "kind": "fee",
        "statement": "1% exit load on redemptions within 365 days",
        "value": {"exit_load_pct": 1, "window_days": 365},
        "required_disclaimer": None,
        "valid_until": None,
    },
    {
        "org_id": ORG_ID,
        "campaign_id": DIWALI,
        "code": "F-112",
        "kind": "rate",
        "statement": "Flexi-Cap 3-yr historical CAGR is 14.2% as of Q3 2026",
        "value": {
            "scheme": "Flexi-Cap",
            "cagr_3y_pct": 14.2,
            "as_of": "Q3 2026",
            "historical": True,
        },
        "required_disclaimer": (
            "Mutual Fund investments are subject to market risks, "
            "read all scheme related documents carefully."
        ),
        "valid_until": "2026-12-31T23:59:59+05:30",
    },
    {
        "org_id": ORG_ID,
        "campaign_id": DIWALI,
        "code": "E-19",
        "kind": "event",
        "statement": "Diwali Wealth Webinar: online only, Oct 28, 7:00 PM IST",
        "value": {
            "name": "Diwali Wealth Webinar",
            "date": "2026-10-28",
            "time": "19:00",
            "tz": "Asia/Kolkata",
            "venue": "online",
        },
        "required_disclaimer": None,
        "valid_until": "2026-11-15T23:59:59+05:30",
    },
    {
        "org_id": ORG_ID,
        "campaign_id": NAVRATRI,
        "code": "E-11",
        "kind": "event",
        "statement": "Navratri Investor Meet: Oct 18, Hall B, Chandigarh",
        "value": {
            "name": "Navratri Investor Meet",
            "date": "2026-10-18",
            "venue": "Hall B, Chandigarh",
        },
        "required_disclaimer": None,
        "valid_until": "2026-10-19T00:00:00+05:30",
    },
]


def _ex(kind: str, text: str) -> dict[str, str]:
    return {"kind": kind, "text": text, "source": "guide"}


RULE_CARDS: list[dict[str, Any]] = [
    {
        "code": "TV-02",
        "dimension": "tone",
        "title": "Warm, plain-spoken, confident; no hype",
        "summary": "Sound like a knowledgeable friend: warm and clear, never breathless or salesy.",
        "body": (
            "PayWise copy is warm, plain-spoken and confident. Use everyday words and short "
            'sentences. Avoid hype: no superlatives like "best ever", "unbeatable" or "skyrocket", '
            "no stacked exclamation marks, and no urgency we cannot back up. Confidence comes from "
            "facts, not volume."
        ),
        "examples": [
            _ex("do", "Start a SIP in two minutes and see exactly what you pay."),
            _ex("dont", "The BEST investment app EVER!!! Your money will skyrocket!"),
        ],
        "severity": "warning",
        "source_page": 4,
    },
    {
        "code": "TV-04",
        "dimension": "tone",
        "title": "Playful, not flippant",
        "summary": "A light touch is welcome, but never joke about money, losses or risk.",
        "body": (
            "Festive and playful language is welcome where it fits the moment. Do not be flippant "
            "about money: no jokes about losing savings, gambling metaphors, or treating investing "
            "as a game."
        ),
        "examples": [],
        "severity": "suggestion",
        "source_page": 5,
    },
    {
        "code": "CL-03",
        "dimension": "claims",
        "title": "No guaranteed or assured returns on market-linked products",
        "summary": (
            'Never promise, guarantee or "assure" returns on mutual funds or other market-linked '
            "products."
        ),
        "body": (
            "Mutual funds and other market-linked products carry market risk. Copy must never use "
            '"guaranteed", "assured", "fixed", "risk-free" or "lock in" language about their '
            "returns. Past performance may be quoted only as historical, with its as-of date and "
            "the standard mutual-fund risk disclaimer."
        ),
        "examples": [
            _ex(
                "do",
                "Flexi-Cap delivered 14.2% CAGR over 3 years (as of Q3 2026). "
                "Past performance may not be sustained.",
            ),
            _ex("dont", "Lock in 14.2% assured annual returns!"),
        ],
        "severity": "blocker",
        "source_page": 9,
    },
    {
        "code": "G-07",
        "dimension": "terms",
        "title": 'Write "PayWise", camel-cased; never "Paywise app"',
        "summary": 'The brand name is always "PayWise" with a capital W, and never "Paywise app".',
        "body": (
            'Our name is PayWise: one word, capital P and capital W. Do not write "Paywise", '
            '"Pay Wise" or "PayWise app". PayWise is the company and the product, not only an app.'
        ),
        "examples": [
            _ex("do", "Start a SIP on PayWise."),
            _ex("dont", "Start a SIP on Paywise app."),
        ],
        "severity": "warning",
        "source_page": 7,
    },
    {
        "code": "VS-02",
        "dimension": "visual",
        "title": "Warm-neutral image palette; no cold blue casts",
        "summary": "Imagery uses warm-neutral tones; avoid cold, blue-tinted photography.",
        "body": (
            "Photography and illustration sit in a warm-neutral palette (off-white, sand, "
            "terracotta, vermilion accents). Avoid cold blue casts and desaturated corporate stock "
            "imagery."
        ),
        "examples": [],
        "severity": "warning",
        "source_page": 12,
    },
    {
        "code": "A-01",
        "dimension": "access",
        "title": "Reading grade 9 or below for retail audiences",
        "summary": "Retail-facing copy should read at grade 9 or below.",
        "body": (
            "Copy for retail investors must score at or below grade 9 on standard readability "
            "measures. Prefer short sentences, common words and one idea per sentence. Explain any "
            "financial term the first time it appears."
        ),
        "examples": [],
        "severity": "suggestion",
        "source_page": 14,
    },
]
