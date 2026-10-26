"""P13: example generation for UNCLEAR rules and the activity simulator's plan (no network)."""

from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from brandlens_worker.llm.cache import LLMCache
from brandlens_worker.llm.router import LLMRouter
from brandlens_worker.notify import unclear_rule_payload
from brandlens_worker.pipeline.examples import ExamplesOutput, build_message, novel, redact
from brandlens_worker.prompts import load_prompt
from tests.fakes import ScriptedProvider

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
import simulate_activity as sim

EXAMPLES = {
    "examples": [
        {"kind": "do", "text": "Light up Diwali with a SIP that grows at your pace.",
         "why": "Festive framing, nothing flippant about money."},
        {"kind": "dont", "text": "Hit the Diwali jackpot with mid-caps!",
         "why": "A gambling metaphor treats investing as a game."},
        {"kind": "dont", "text": "Bet big on your SIP this Diwali",
         "why": "Copies a dismissed phrase."},
    ]
}  # fmt: skip


def test_examples_output_needs_three_and_both_kinds() -> None:
    assert len(ExamplesOutput.model_validate(EXAMPLES).examples) == 3
    only_do = {"examples": [dict(EXAMPLES["examples"][0])] * 3}
    with pytest.raises(ValidationError):
        ExamplesOutput.model_validate(only_do)
    with pytest.raises(ValidationError):
        ExamplesOutput.model_validate({"examples": EXAMPLES["examples"][:2]})


def test_message_redacts_and_dedupes_dismissed_quotes() -> None:
    msg = build_message(
        "TV-04", "Playful, not flippant", "No gambling metaphors.",
        [{"kind": "dont", "text": "Jackpot!"}],
        ["Bet big on your SIP this Diwali", "Bet big on your SIP this Diwali",
         "Mail rohan@example.com for the jackpot"],
    )  # fmt: skip
    assert msg.count("Bet big on your SIP this Diwali") == 1
    assert "rohan@example.com" not in msg and "⟦REDACTED:email⟧" in msg
    assert "<dismissed>" in msg and "dont: Jackpot!" in msg
    assert redact("call 9876543210") == "call ⟦REDACTED:phone⟧"


def test_examples_that_copy_a_dismissed_phrase_are_dropped() -> None:
    kept = novel(ExamplesOutput.model_validate(EXAMPLES), ["bet big on your SIP this Diwali "])
    assert [e["kind"] for e in kept] == ["do", "dont"]


async def test_examples_prompt_runs_through_the_router() -> None:
    system, version = load_prompt("examples")
    assert version == "examples@1" and "<dismissed>" in system
    provider = ScriptedProvider("groq", [EXAMPLES])
    out, _meta = await LLMRouter([provider], cache=LLMCache(enabled=False)).generate(
        system, "<rule>{}</rule>", ExamplesOutput, prompt_version=version
    )
    assert provider.calls == 1 and len(out.examples) == 3


def test_unclear_rule_discord_message_has_no_draft_text() -> None:
    p = unclear_rule_payload("TV-04", 60, "https://brandlens.example/")
    embed = p["embeds"][0]
    assert embed["title"] == "⚠️ Rule TV-04 is UNCLEAR (GCS 60)"
    assert embed["url"] == "https://brandlens.example/insights"


def test_simulated_history_lands_as_in_the_plan() -> None:
    now = datetime(2026, 10, 26, 12, tzinfo=UTC)
    contents = sim.plan(now)
    assert sim.expected_gcs(contents) == {
        "TV-04": (41, 60), "VS-02": (22, 73), "CL-03": (63, 97), "G-07": (88, 99),
    }  # fmt: skip
    assert all(c.title.startswith(sim.PREFIX) for c in contents)
    assert all(now - timedelta(days=30) <= c.created <= now for c in contents)
    week = [
        f for c in contents for f in c.findings
        if f.severity == "blocker" and c.created >= now - timedelta(days=7)
    ]  # fmt: skip
    assert len(week) == sim.BLOCKERS_THIS_WEEK
    decided = [c for c in contents if c.decided]
    assert all(c.created < c.decided <= now for c in decided)  # type: ignore[operator]
    assert sim.plan(now) == contents  # deterministic for a seed
