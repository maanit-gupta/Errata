from datetime import datetime
from typing import Any

import numpy as np
import pytest

from brandlens_worker.jobs.review_version import to_row
from brandlens_worker.pipeline.filters import run_filters
from brandlens_worker.pipeline.filters.entities import extract
from brandlens_worker.pipeline.ingest import IngestError, ingest, normalise
from brandlens_worker.pipeline.protect import detect, luhn_ok, pan_ok, protect
from brandlens_worker.pipeline.retrieve import build_queries, merge
from brandlens_worker.pipeline.routing import RoutingFinding, has_open_blockers, route
from brandlens_worker.pipeline.run import VersionInput, run_stages_1_to_4
from tests.vault_fixture import HERO, paywise_vault

CLEAN_DRAFTS = [
    "Start a SIP on PayWise this Diwali and join the Diwali Wealth Webinar, online on Oct 28 at "
    "7:00 PM IST. Register now.",
    "Flexi-Cap delivered 14.2% CAGR over 3 years (as of Q3 2026). Past performance may not be "
    "sustained. Mutual Fund investments are subject to market risks, read all scheme related "
    "documents carefully.",
    "Redemptions within 365 days carry a 1% exit load on PayWise.",
    "Light a diya, then light up your savings. Start a small monthly SIP on PayWise today.",
    "Questions about your SIP? Our team is here to help on PayWise, every day, 24/7.",
    # Golden-set negative (P14): the idiom reassures; it promises nothing about returns.
    "Rest assured, starting a SIP on PayWise takes two minutes, and you can pause it any time.",
]


def findings_for(text: str, **vault_kw: Any) -> list[tuple[str, str, list[str], str]]:
    doc = ingest("text", body=text)
    return [
        (f.dimension, f.severity, f.codes, doc.original[slice(*doc.to_original(f.start, f.end))])
        for f in run_filters(doc, paywise_vault(**vault_kw))
    ]


# ------------------------------------------------------------------ stage 1: ingest


def test_normalise_keeps_a_char_map_to_the_original() -> None:
    original = "Hello,\u00a0\u00a0 PayWise\r\n  users!"
    doc = normalise(original)
    assert doc.text == "Hello, PayWise\n users!"
    i = doc.text.index("PayWise")
    s, e = doc.to_original(i, i + len("PayWise"))
    assert original[s:e] == "PayWise"


def test_ingest_limits_and_formats() -> None:
    with pytest.raises(IngestError) as exc:
        ingest("text", body="word " * 2001)
    assert exc.value.code == "too_long"
    with pytest.raises(IngestError):
        ingest("text", body="   ")
    assert (
        ingest("html", body="<p>Hi <b>there</b></p><script>x()</script><p>Bye</p>").text
        == "Hi there\n\nBye"
    )
    with pytest.raises(NotImplementedError):
        ingest("pdf", data=b"%PDF")


# ------------------------------------------------------------------ stage 2: protect


@pytest.mark.parametrize(
    ("kind", "positive", "negative"),
    [
        ("email", "write to asha.k@paywise.in today", "write to asha at paywise"),
        ("phone", "call +91 98765 43210 now", "call 12345 67890 now"),
        ("pan", "PAN ABCPE1234F on file", "code ABCXE1234F on file"),
        ("aadhaar", "Aadhaar 2345 6789 0123", "ref 0345 6789 0123"),
        ("card", "card 4111 1111 1111 1111", "card 4111 1111 1111 1112"),
        ("ifsc", "IFSC HDFC0001234", "code HDFC1001234"),
        ("account_number", "A/c No: 123456789012", "order 123456789012x"),
        ("secret", "key sk-abcdefghijklmnop1234", "the sk-short key"),
        ("secret", "AKIAABCDEFGHIJKLMNOP", "AKIA-not-a-key"),
        ("secret", "eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4", "eyJ only"),
    ],
)
def test_detectors(kind: str, positive: str, negative: str) -> None:
    assert kind in {r.kind for r in detect(positive)}, positive
    assert kind not in {r.kind for r in detect(negative)}, negative


def test_luhn_and_pan_validators() -> None:
    assert luhn_ok("4111111111111111") and not luhn_ok("4111111111111112")
    assert pan_ok("ABCPE1234F") and not pan_ok("ABCXE1234F") and not pan_ok("ABCP1234EF")


def test_protect_redacts_only_the_llm_copy() -> None:
    doc = ingest("text", body="Mail asha.k@paywise.in about SIP on PayWise.")
    red = protect(doc)
    assert red.text == "Mail ⟦REDACTED:email⟧ about SIP on PayWise."
    assert "asha.k@paywise.in" in doc.text  # deterministic stages see the original
    assert protect(ingest("text", body=HERO)).redactions == []


# ------------------------------------------------------------------ stage 3: filters


def test_hero_draft_produces_exactly_the_expected_findings() -> None:
    assert findings_for(HERO) == [
        ("terms", "warning", ["G-07"], "Paywise app"),
        ("facts", "blocker", ["F-048"], "0% exit load"),
        # CL-03 lexicon hit merged with the F-112 missing-disclaimer check (one finding, both cited)
        ("claims", "blocker", ["CL-03", "F-112"], "lock in 14.2% assured annual returns"),
        # E-19 date and venue drift, both caught as one span; E-11 is the bleed source
        ("facts", "blocker", ["E-19", "E-11"], "Oct 18 at Hall B, Chandigarh"),
    ]


def test_usability_caption_two_has_the_same_four_issues() -> None:
    """docs/usability/tasks.md: both A/B captions carry the same four deterministic issues, so the
    benchmark doesn't depend on LLM quota. Caption 1 is HERO (above)."""
    caption_two = (
        "Invest on Pay Wise this Diwali with 0% exit load and enjoy assured returns every year. "
        "Meet our team on Oct 18 at Hall B, Chandigarh. Register now."
    )
    assert [(dim, codes) for dim, _, codes, _ in findings_for(caption_two)] == [
        ("terms", ["G-07"]),
        ("facts", ["F-048"]),
        ("claims", ["CL-03"]),
        ("facts", ["E-19", "E-11"]),
    ]


def test_hero_rewrites_are_deterministic_substitutions() -> None:
    doc = ingest("text", body=HERO)
    rewrites = {tuple(f.codes): f.rewrite for f in run_filters(doc, paywise_vault())}
    assert rewrites[("G-07",)] == "PayWise"
    assert rewrites[("F-048",)] == "1% exit load"
    assert rewrites[("E-19", "E-11")] == "Oct 28, 7:00 PM IST (online)"
    claims = rewrites[("CL-03", "F-112")]
    assert claims is not None and "historical" in claims and "subject to market risks" in claims


def test_bleed_explanation_cites_the_wrong_campaign_fact() -> None:
    doc = ingest("text", body=HERO)
    bleed = next(f for f in run_filters(doc, paywise_vault()) if "E-11" in f.codes)
    assert bleed.fact_id == "fact-E-19"  # primary citation: this campaign's fact
    assert "E-11" in bleed.explanation and "Navratri Savings 2026" in bleed.explanation
    assert "Diwali SIP 2026" in bleed.explanation


@pytest.mark.parametrize("text", CLEAN_DRAFTS)
def test_clean_drafts_have_no_deterministic_findings(text: str) -> None:
    assert findings_for(text) == []


def test_bleed_works_in_the_other_direction() -> None:
    from tests.vault_fixture import d

    # Reviewing for Navratri: the Diwali webinar date is the bleed; E-11 is this campaign's event.
    found = findings_for("Join the Diwali Wealth Webinar on Oct 28!", campaign_id=d.NAVRATRI)
    assert found == [("facts", "blocker", ["E-11", "E-19"], "Oct 28")]


def test_expired_in_scope_fact_is_a_warning() -> None:
    later = datetime.fromisoformat("2026-11-20T00:00:00+05:30")
    found = findings_for("Join our Diwali Wealth Webinar, online on Oct 28.", now=later)
    assert ("facts", "warning", ["E-19"], "Oct 28") in found


def test_terms_casing_possessive_and_correct_usage() -> None:
    assert findings_for("Paywise's new SIP") == [("terms", "warning", ["G-07"], "Paywise")]
    assert findings_for("PayWise's new SIP is here.") == []
    assert findings_for("paywiseapp.com") == []  # not on a token boundary

    # Addresses aren't brand copy (golden set, P14).
    def terms(text: str) -> list[str]:
        return [f[3] for f in findings_for(text) if f[0] == "terms"]

    assert terms("Register at https://paywise.example/webinar today.") == []
    assert terms("Write to help@paywise.example or visit www.paywise.example.") == []
    assert terms("Paywise: see paywise.example/sip") == ["Paywise"]


def test_assured_returns_still_fire_after_the_rest_assured_exception() -> None:
    assert [c for _, _, c, _ in findings_for("Rest assured: assured returns on every SIP.")] == [
        ["CL-03"]
    ]


def test_tone_heuristics() -> None:
    hype = findings_for("Our returns will skyrocket! Start now! Don't wait! Join today!")
    assert ("tone", "warning", ["TV-02"], "skyrocket") in hype
    assert any(f[0] == "tone" and f[2] == ["TV-02"] and f[1] == "suggestion" for f in hype)
    shouting = findings_for("The BEST investment app EVER. Start a SIP on PayWise.")
    assert [f[3] for f in shouting] == ["BEST investment app EVER"]
    # Acronyms and a lone capitalised wordmark aren't shouting (golden set, P14).
    assert findings_for("Flexi-Cap's 3-yr historical CAGR, as of Q3 2026, on PayWise.") == []
    assert findings_for("Start your Diwali SIP. NORTHFUND") == []


def test_access_link_text_and_reading_grade() -> None:
    found = findings_for(
        "Read the [click here](https://paywise.example/sip) guide or https://paywise.example."
    )
    assert ("access", "warning", ["WCAG 2.4.4"], "click here") in found
    assert ("access", "warning", ["WCAG 2.4.4"], "https://paywise.example.") in found
    dense = " ".join(
        ["Notwithstanding the aforementioned considerations, systematic investment methodologies "
         "necessitate comprehensive understanding of multifaceted volatility characteristics."] * 6
    )  # fmt: skip
    assert any(f[2] == ["A-01"] for f in findings_for(dense))


def test_entities() -> None:
    kinds = [
        (e.kind, e.value)
        for e in extract("Oct 18 at 7 PM, 18/10, ₹1,499 and 14.2% at Hall B, online")
    ]
    assert ("date", (10, 18)) in kinds and ("time", "19:00") in kinds
    assert ("money", 1499.0) in kinds and ("percent", 14.2) in kinds
    assert ("venue", "hall b") in kinds and ("venue", "online") in kinds
    assert not [e for e in extract("support 24/7") if e.kind == "date"]


# ------------------------------------------------------------------ stage 4, routing, run


def test_retrieval_queries_and_merge() -> None:
    q = build_queries("First sentence here. Second one is here too! x.")
    assert q[0].startswith("First") and "Second one is here too!" in q
    merged = merge(
        [
            [{"id": "a", "similarity": 0.5}, {"id": "b", "similarity": 0.7}],
            [{"id": "a", "similarity": 0.9}],
        ]
    )
    assert [(r["id"], r["similarity"]) for r in merged] == [("a", 0.9), ("b", 0.7)]


def test_routing_per_spec_section_10() -> None:
    assert route([]) == ("manager", 0.0)
    assert route([RoutingFinding("terms", "warning")]) == ("manager", 3.0)
    assert route([RoutingFinding("claims", "warning")]) == ("legal", 7.0)
    assert route([RoutingFinding("access", "warning")]) == ("a11y", 5.0)
    assert route([RoutingFinding("visual", "warning")]) == ("brand", 3.0)
    assert route([RoutingFinding("claims", "blocker", "routed")]) == ("legal", 9.0)
    assert has_open_blockers([RoutingFinding("facts", "blocker")])
    assert not has_open_blockers([RoutingFinding("facts", "blocker", "dismissed")])


def test_to_row_maps_spans_to_the_original_text() -> None:
    original = "Start  a SIP on  Paywise app\u00a0today."
    doc = ingest("text", body=original)
    [finding] = run_filters(doc, paywise_vault())
    row = to_row(finding, doc, {"rule-G-07": "G-07"})
    assert row["quote"] == "Paywise app"
    assert original[row["span"]["start"] : row["span"]["end"]] == "Paywise app"
    assert row["confidence"] == 1.0 and row["source"] == "deterministic"


async def test_stages_never_call_the_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    from brandlens_worker.llm import router

    async def boom(*_: Any, **__: Any) -> Any:
        raise AssertionError("LLM router must not be invoked in stages 1-4")

    monkeypatch.setattr(router.LLMRouter, "generate", boom)
    calls: list[int] = []

    async def embed(texts: list[str]) -> Any:
        return np.ones((len(texts), 384), dtype=np.float32)

    async def match(_: Any) -> list[dict[str, Any]]:
        calls.append(1)
        return [
            {"id": "x", "code": "CL-03", "kind": "rule", "dimension": "claims", "similarity": 0.6}
        ]

    result = await run_stages_1_to_4(
        VersionInput("text", body=HERO), paywise_vault(), embed=embed, match_vault=match, topk=8
    )
    assert len(result.findings) == 4
    assert calls and result.retrieved[0]["code"] == "CL-03"
    assert set(result.timings) == {"ingest", "protect", "filters", "retrieve"}


def test_carry_over_keeps_routed_and_dismissed_decisions() -> None:
    from brandlens_worker.jobs.review_version import carry_over

    rows = [
        {
            "dimension": "claims",
            "rule_id": "r1",
            "fact_id": "f1",
            "quote": "lock in 14.2%",
            "status": "open",
        },
        {
            "dimension": "terms",
            "rule_id": "r2",
            "fact_id": None,
            "quote": "Paywise",
            "status": "open",
        },
    ]
    prior = [
        {"dimension": "claims", "rule_id": "r1", "fact_id": "f1", "quote": "lock in 14.2%", "status": "routed",
         "dismiss_reason": None, "dismiss_note": None, "resolved_by": "u1"},
    ]  # fmt: skip
    carry_over(rows, prior)
    assert rows[0]["status"] == "routed" and rows[0]["resolved_by"] == "u1"
    assert rows[1]["status"] == "open"
    to, _ = route([RoutingFinding(r["dimension"], "blocker", r["status"]) for r in rows[:1]])
    assert to == "legal"
