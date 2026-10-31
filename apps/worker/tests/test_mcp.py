"""MCP server: auth, protocol, read-only surface, agency scrubbing, the three tools, the resource
and the prompt. A fake store over the real PayWise fixture vault, so precheck and claim checks run
the real Stage 1/3 code (no DB, no model). SQL-side guarantees: supabase/tests/07_mcp_api_keys;
end to end against Postgres: tests/test_mcp_server.py; live: scripts/mcp_check.py.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from datetime import datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from brandlens_worker import config
from brandlens_worker.mcp import build_router
from brandlens_worker.mcp.auth import McpAuth, RateLimiter, hash_key, scrub_rule_for_role
from brandlens_worker.mcp.server import SUPPORTED_VERSIONS
from brandlens_worker.mcp.store import Campaign, McpVault
from tests.vault_fixture import HERO, d, paywise_vault

CREATOR_KEY = "bl_mcp_" + "1" * 48
AGENCY_KEY = "bl_mcp_" + "2" * 48
OTHER_ORG_CAMPAIGN = "99999999-0000-4000-8000-000000000001"
DIWALI = Campaign(d.DIWALI, "Diwali SIP 2026", "active", "2026-10-10", "2026-11-15")
NAVRATRI = Campaign(d.NAVRATRI, "Navratri Savings 2026", "ended", "2026-09-22", "2026-10-19")
INTENT = {"goal": "webinar sign-ups", "audience": "first-time investors", "cta": "Register now"}
REMEDIATED = (
    "This Diwali, explore our Flexi-Cap fund on PayWise (3-yr historical CAGR 14.2%, Q3 2026; "
    "1% exit load within 365 days). Join our online Diwali Wealth Webinar on Oct 28 at 7:00 PM "
    "IST. Register now. Mutual Fund investments are subject to market risks, read all scheme "
    "related documents carefully."
)


def rule_row(code: str) -> dict[str, Any]:
    c = next(r for r in d.RULE_CARDS if r["code"] == code)
    return {
        "id": f"rule-{code}",
        "code": code,
        "dimension": c["dimension"],
        "title": c["title"],
        "summary": c["summary"],
        "body": c["body"],
        "examples": c["examples"] or [{"kind": "do", "text": "Example", "source": "guide"}],
        "severity": c["severity"],
        "source_page": 3,
    }


class FakeStore:
    def __init__(self) -> None:
        self.keys = {
            hash_key(CREATOR_KEY): McpAuth("key-1", "org-1", "user-2", "creator"),
            hash_key(AGENCY_KEY): McpAuth("key-2", "org-1", "user-3", "agency_creator"),
        }
        self.internal: set[str] = set()
        self.events: list[dict[str, Any]] = []
        self.resolves = 0
        self.fact_score = 0.9

    async def resolve(self, key_hash: str) -> McpAuth | None:
        self.resolves += 1
        return self.keys.get(key_hash)

    async def find_active_campaign(self, org_id: str, query: str) -> Campaign | None:
        assert org_id == "org-1"
        return DIWALI if query.lower() in DIWALI.name.lower() else None

    async def active_campaigns(self, org_id: str) -> list[Campaign]:
        return [DIWALI]

    async def campaign(self, org_id: str, campaign_id: str) -> Campaign | None:
        return {c.id: c for c in (DIWALI, NAVRATRI)}.get(campaign_id) if org_id == "org-1" else None

    async def campaign_facts(self, org_id: str, campaign_id: str) -> list[dict[str, Any]]:
        live = []
        for f in d.FACTS:
            if f["campaign_id"] not in (None, campaign_id):
                continue
            vu = datetime.fromisoformat(f["valid_until"]) if f["valid_until"] else None
            if vu and vu < datetime.fromisoformat("2026-10-31T00:00:00+05:30"):
                continue
            live.append({**f, "valid_until": vu})
        return live

    async def match(
        self,
        org_id: str,
        campaign_id: str,
        embedding: Sequence[float],
        k: int,
        dimensions: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        rules = [
            {
                "id": "rule-CL-03",
                "code": "CL-03",
                "kind": "rule",
                "dimension": "claims",
                "score": 0.8,
            },
            {
                "id": "rule-TV-02",
                "code": "TV-02",
                "kind": "rule",
                "dimension": "tone",
                "score": 0.7,
            },
        ]
        facts = [
            {"id": "fact-F-112", "code": "F-112", "kind": "fact", "dimension": "facts",
             "score": self.fact_score},
        ]  # fmt: skip
        rows = rules + facts
        if dimensions:
            rows = [r for r in rows if r["dimension"] in dimensions]
        return rows[:k]

    async def rule_cards(self, org_id: str, ids: list[str]) -> list[dict[str, Any]]:
        return [rule_row(i.removeprefix("rule-")) for i in ids]

    async def glossary(self, org_id: str) -> list[dict[str, Any]]:
        return [{"code": "G-07", "preferred": "PayWise", "variants": ["Paywise"], "banned": False}]

    async def load_vault(self, org_id: str, campaign: Campaign) -> McpVault:
        return McpVault(paywise_vault(campaign.id), set(self.internal))

    async def audit(self, auth: McpAuth, event: dict[str, Any]) -> None:
        self.events.append({**event, "key_id": auth.key_id})


class FakeEmbedder:
    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [[1.0] + [0.0] * 383 for _ in texts]


@pytest.fixture
def ctx() -> tuple[TestClient, FakeStore]:
    app = FastAPI()
    store = FakeStore()
    app.state.services = {"mcp_store": store, "embedder": FakeEmbedder()}
    app.include_router(build_router())
    return TestClient(app), store


def rpc(
    c: TestClient, method: str, params: dict[str, Any] | None = None, key: str = CREATOR_KEY
) -> Any:
    body: dict[str, Any] = {"jsonrpc": "2.0", "id": 1, "method": method}
    if params is not None:
        body["params"] = params
    return c.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {key}"})


def call(c: TestClient, tool: str, args: dict[str, Any], key: str = CREATOR_KEY) -> dict[str, Any]:
    out: dict[str, Any] = rpc(c, "tools/call", {"name": tool, "arguments": args}, key).json()
    return out


def result(out: dict[str, Any]) -> dict[str, Any]:
    res = out["result"]
    assert json.loads(res["content"][0]["text"]) == res["structuredContent"]
    payload: dict[str, Any] = res["structuredContent"]
    return payload


# --- auth and transport ----------------------------------------------------------------------


def test_rejects_missing_wrong_and_old_style_keys(ctx: tuple[TestClient, FakeStore]) -> None:
    c, store = ctx
    assert c.post("/v1/mcp", json={}).status_code == 401
    assert rpc(c, "ping", key="bl_mcp_" + "f" * 48).status_code == 401
    res = c.post("/v1/mcp", json={}, headers={"Authorization": f"Basic {CREATOR_KEY}"})
    assert res.status_code == 401 and res.headers["www-authenticate"].startswith("Bearer")
    before = store.resolves
    assert rpc(c, "ping", key="ek_" + "1" * 48).status_code == 401  # wrong prefix: no DB lookup
    assert store.resolves == before


def test_failed_auth_is_rate_limited_per_client(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    for _ in range(config.MCP_AUTH_FAILURES_PER_MINUTE):
        assert rpc(c, "ping", key="bl_mcp_bad").status_code == 401
    assert rpc(c, "ping", key="bl_mcp_bad").status_code == 429


def test_key_rate_limit_returns_429(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    for _ in range(config.MCP_RATE_PER_MINUTE):
        assert rpc(c, "ping").status_code == 200
    res = rpc(c, "ping")
    assert res.status_code == 429 and res.headers["retry-after"] == "60"
    assert rpc(c, "ping", key=AGENCY_KEY).status_code == 200  # per key, not global


def test_transport_edges(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    h = {"Authorization": f"Bearer {CREATOR_KEY}", "content-type": "application/json"}
    assert c.get("/v1/mcp").status_code == 405
    assert c.post("/v1/mcp", json=[{"jsonrpc": "2.0"}], headers=h).status_code == 400
    assert c.post("/v1/mcp", content=b"{nope", headers=h).json()["error"]["code"] == -32700
    big = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping", "pad": "x" * 140_000})
    assert c.post("/v1/mcp", content=big, headers=h).status_code == 413
    h["MCP-Protocol-Version"] = "1999-01-01"
    assert (
        c.post("/v1/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"}, headers=h).status_code
        == 400
    )
    note = {"jsonrpc": "2.0", "method": "notifications/initialized"}
    h["MCP-Protocol-Version"] = SUPPORTED_VERSIONS[1]
    res = c.post("/v1/mcp", json=note, headers=h)
    assert res.status_code == 202 and res.content == b""


def test_unavailable_without_services() -> None:
    app = FastAPI()
    app.include_router(build_router())
    res = TestClient(app).post(
        "/v1/mcp", json={}, headers={"Authorization": f"Bearer {CREATOR_KEY}"}
    )
    assert res.status_code == 503


@pytest.mark.parametrize(
    "body",
    [
        {"jsonrpc": "1.0", "id": 1, "method": "ping"},
        {"jsonrpc": "2.0", "id": 1},
        {"jsonrpc": "2.0", "id": None, "method": "ping"},
        {"jsonrpc": "2.0", "id": {"x": 1}, "method": "ping"},
    ],
)
def test_invalid_requests(ctx: tuple[TestClient, FakeStore], body: dict[str, Any]) -> None:
    c, _ = ctx
    res = c.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {CREATOR_KEY}"})
    assert res.json()["error"]["code"] == -32600


# --- protocol surface --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("asked", "got"), [("2025-06-18", "2025-06-18"), ("2099-01-01", "2025-11-25")]
)
def test_initialize(ctx: tuple[TestClient, FakeStore], asked: str, got: str) -> None:
    c, _ = ctx
    res = rpc(c, "initialize", {"protocolVersion": asked, "capabilities": {}}).json()["result"]
    assert res["protocolVersion"] == got
    assert set(res["capabilities"]) == {"tools", "resources", "prompts"}
    assert "get_campaign_context" in res["instructions"]


def test_surface_is_read_only(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    listed = rpc(c, "tools/list").json()["result"]["tools"]
    assert {t["name"] for t in listed} == {
        "get_campaign_context",
        "precheck_draft_fast",
        "verify_claim_evidence",
    }
    for t in listed:
        assert t["annotations"]["readOnlyHint"] is True
        assert t["inputSchema"]["additionalProperties"] is False
        assert not {"org_id", "user_id", "role"} & set(t["inputSchema"]["properties"])
    for tool in ("submit_to_brandlens_queue", "log_rule_feedback", "create_fact"):
        assert call(c, tool, {})["error"]["code"] == -32602
    for method in ("resources/write", "sampling/createMessage", "resources/subscribe"):
        assert rpc(c, method).json()["error"]["code"] == -32601


def test_params_and_arguments_must_be_objects(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": ["x"]}
    res = c.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {CREATOR_KEY}"}).json()
    assert res["error"]["code"] == -32602
    res = rpc(c, "tools/call", {"name": "precheck_draft_fast", "arguments": "draft"}).json()
    assert res["error"]["code"] == -32602


# --- tool 1: get_campaign_context --------------------------------------------------------------


def test_campaign_context_grounds_the_writer(ctx: tuple[TestClient, FakeStore]) -> None:
    c, store = ctx
    out = result(
        call(c, "get_campaign_context", {"campaign_query": "Diwali SIP", "intent": INTENT})
    )
    assert out["campaign"]["id"] == d.DIWALI
    codes = {f["fact_id"] for f in out["approved_facts"]}
    assert {"E-19", "F-048", "F-112"} <= codes and "E-11" not in codes
    assert [r["code"] for r in out["active_rule_cards"]] == ["CL-03", "TV-02"]
    assert {"rule", "examples", "source_page"} <= set(out["active_rule_cards"][0])
    assert out["glossary"][0]["use"] == "PayWise"
    assert out["mandatory_intent_contract"]["cta"] == "Register now"
    assert store.events[-1] == {
        "type": "mcp_tool", "tool": "get_campaign_context", "campaign_id": d.DIWALI,
        "facts": len(out["approved_facts"]), "rules": 2, "key_id": "key-1",
    }  # fmt: skip


def test_agency_key_gets_the_agency_view(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    out = result(
        call(c, "get_campaign_context", {"campaign_query": "Diwali", "intent": INTENT}, AGENCY_KEY)
    )
    for card in out["active_rule_cards"]:
        assert set(card) == {"code", "dimension", "severity", "title", "summary"}
    body = rule_row("CL-03")["body"]
    assert body not in json.dumps(out)


def test_unknown_campaign_is_a_tool_error_listing_active_ones(
    ctx: tuple[TestClient, FakeStore],
) -> None:
    c, _ = ctx
    res = call(c, "get_campaign_context", {"campaign_query": "Navratri", "intent": INTENT})[
        "result"
    ]
    assert res["isError"] is True and "Diwali SIP 2026" in res["structuredContent"]["error"]


@pytest.mark.parametrize(
    "args",
    [
        {"campaign_query": "Diwali"},
        {"campaign_query": "", "intent": INTENT},
        {"campaign_query": "Diwali", "intent": {**INTENT, "cta": ""}},
        {"campaign_query": "Diwali", "intent": INTENT, "org_id": "org-2"},
        {"campaign_query": "Diwali", "intent": {**INTENT, "role": "brand_admin"}},
    ],
)
def test_campaign_context_validates(
    ctx: tuple[TestClient, FakeStore], args: dict[str, Any]
) -> None:
    c, store = ctx
    out = call(c, "get_campaign_context", args)
    assert out["error"]["code"] == -32602
    assert store.events == []


# --- tool 2: precheck_draft_fast ----------------------------------------------------------------


def test_precheck_catches_the_hero_caption(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    draft = HERO + " Register now"
    out = result(
        call(
            c,
            "precheck_draft_fast",
            {"draft_text": draft, "campaign_id": d.DIWALI, "intent": INTENT},
        )
    )
    assert out["status"] == "BLOCKED" and out["blocker_count"] == 3
    assert {f["code"] for f in out["findings"]} == {"G-07", "F-048", "CL-03", "E-19"}
    for f in out["findings"]:
        assert draft[f["span"]["start"] : f["span"]["end"]] == f["quote"]
        assert f["source"] == "deterministic" and f["code"]
    fee = next(f for f in out["findings"] if f["code"] == "F-048")
    assert fee["suggested_fix"] == "1% exit load"
    assert out["intent_verification"]["cta_retained"] is True
    assert out["checks_ms"] < 50


def test_precheck_passes_the_remediated_draft(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    out = result(
        call(
            c,
            "precheck_draft_fast",
            {"draft_text": REMEDIATED, "campaign_id": d.DIWALI, "intent": INTENT},
        )
    )
    assert out["status"] == "PASS_DETERMINISTIC" and out["findings"] == []
    assert "Errata" in out["next_step"]


def test_precheck_intent_cta_and_baseline(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    no_cta = REMEDIATED.replace("Register now. ", "")
    out = result(
        call(
            c,
            "precheck_draft_fast",
            {"draft_text": no_cta, "campaign_id": d.DIWALI, "intent": INTENT},
        )
    )
    assert (
        out["status"] == "BLOCKED" and out["intent_verification"]["failure_reason"] == "cta_missing"
    )
    out = result(
        call(
            c,
            "precheck_draft_fast",
            {
                "draft_text": REMEDIATED,
                "campaign_id": d.DIWALI,
                "intent": INTENT,
                "baseline_text": REMEDIATED,
            },
        )
    )
    assert out["intent_verification"]["cosine_similarity"] == 1.0
    assert out["intent_verification"]["threshold"] == config.INTENT_COSINE


def test_precheck_withholds_findings_that_cite_internal_items(
    ctx: tuple[TestClient, FakeStore],
) -> None:
    c, store = ctx
    store.internal = {"F-048"}
    out = result(
        call(
            c,
            "precheck_draft_fast",
            {"draft_text": HERO, "campaign_id": d.DIWALI, "intent": INTENT},
        )
    )
    assert "F-048" not in json.dumps(out["findings"]) and out["withheld_internal"] == 1


def test_precheck_scope_and_validation(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    res = call(
        c,
        "precheck_draft_fast",
        {"draft_text": HERO, "campaign_id": OTHER_ORG_CAMPAIGN, "intent": INTENT},
    )
    assert res["result"]["isError"] is True
    for bad in (
        {"draft_text": "x" * 15_001, "campaign_id": d.DIWALI, "intent": INTENT},
        {"draft_text": HERO, "campaign_id": "not-a-uuid", "intent": INTENT},
        {"draft_text": HERO, "campaign_id": d.DIWALI},
    ):
        assert call(c, "precheck_draft_fast", bad)["error"]["code"] == -32602


# --- tool 3: verify_claim_evidence -----------------------------------------------------------


def test_assured_returns_claim_is_a_blocker(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    out = result(call(c, "verify_claim_evidence", {
        "claim_statement": "14.2% assured annual returns", "campaign_id": d.DIWALI}))  # fmt: skip
    assert out["verdict"] == "BLOCKER" and out["substantiated"] is False
    assert "CL-03" in {f["code"] for f in out["findings"]} | {
        c for f in out["findings"] for c in f["also_cites"]
    }
    assert [r["code"] for r in out["governing_claim_rules"]] == ["CL-03"]
    assert out["required_disclaimers"]  # F-112's disclaimer, to use instead


def test_clean_claim_with_disclaimer_is_substantiated(ctx: tuple[TestClient, FakeStore]) -> None:
    c, store = ctx
    claim = (
        "Flexi-Cap 3-yr historical CAGR is 14.2% as of Q3 2026. Mutual Fund investments are "
        "subject to market risks, read all scheme related documents carefully."
    )
    out = result(
        call(c, "verify_claim_evidence", {"claim_statement": claim, "campaign_id": d.DIWALI})
    )
    assert out["verdict"] == "SUBSTANTIATED_CITE_FACT_AND_DISCLAIMER", out["findings"]
    assert out["matching_facts"][0]["fact_id"] == "F-112"
    store.fact_score = 0.5
    out = result(
        call(c, "verify_claim_evidence", {"claim_statement": claim, "campaign_id": d.DIWALI})
    )
    assert out["verdict"] == "UNSUBSTANTIATED_NO_MATCHING_FACT"


# --- resource and prompt -------------------------------------------------------------------------


def test_active_campaigns_resource(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    listed = rpc(c, "resources/list").json()["result"]["resources"]
    assert [r["uri"] for r in listed] == ["brandvault://campaigns/active"]
    res = rpc(c, "resources/read", {"uri": "brandvault://campaigns/active"}).json()["result"]
    data = json.loads(res["contents"][0]["text"])
    assert [x["name"] for x in data["campaigns"]] == ["Diwali SIP 2026"]
    assert (
        rpc(c, "resources/read", {"uri": "brandvault://facts/all"}).json()["error"]["code"]
        == -32002
    )


def test_governed_draft_prompt(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    assert (
        rpc(c, "prompts/list").json()["result"]["prompts"][0]["name"] == "brandlens-governed-draft"
    )
    args = {
        "campaign_name": "Diwali SIP 2026",
        "goal": "sign-ups",
        "audience": "new investors",
        "cta": "Register now",
    }
    msg = rpc(c, "prompts/get", {"name": "brandlens-governed-draft", "arguments": args}).json()
    text = msg["result"]["messages"][0]["content"]["text"]
    assert "precheck_draft_fast" in text and "submit_to_brandlens_queue" not in text
    bad = rpc(c, "prompts/get", {"name": "brandlens-governed-draft", "arguments": {"goal": "x"}})
    assert bad.json()["error"]["code"] == -32602


# --- logging and helpers ---------------------------------------------------------------------


def test_logs_and_audit_never_carry_text_or_keys(
    ctx: tuple[TestClient, FakeStore], caplog: pytest.LogCaptureFixture
) -> None:
    c, store = ctx
    with caplog.at_level(logging.INFO):
        call(
            c,
            "precheck_draft_fast",
            {"draft_text": HERO, "campaign_id": d.DIWALI, "intent": INTENT},
        )
        call(
            c,
            "verify_claim_evidence",
            {"claim_statement": "assured Chandigarh returns", "campaign_id": d.DIWALI},
        )
    dumped = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records) + json.dumps(
        store.events
    )
    for secret in ("Hall B", "Chandigarh", "assured", CREATOR_KEY, hash_key(CREATOR_KEY)):
        assert secret not in dumped
    rec = next(r for r in caplog.records if r.getMessage() == "mcp tool call")
    assert rec.__dict__["key_id"] == "key-1" and rec.__dict__["role"] == "creator"


def test_scrubber_matches_the_app_boundary() -> None:
    row = rule_row("CL-03")
    staff = scrub_rule_for_role(row, McpAuth("k", "o", "u", "manager"))
    agency = scrub_rule_for_role(row, McpAuth("k", "o", "u", "agency_creator"))
    assert staff["rule"] == row["body"] and staff["source_page"] == 3
    assert set(agency) == {"code", "dimension", "severity", "title", "summary"}


def test_rate_limiter() -> None:
    rl = RateLimiter(per_minute=2)
    assert rl.allow("t", 0) and rl.allow("t", 1)
    assert not rl.allow("t", 2)
    assert rl.allow("t", 61)
    assert rl.allow("u", 0, consume=False) and rl.allow("u", 0) and rl.allow("u", 0)
    assert not rl.allow("u", 1, consume=False)
    for i in range(300):
        rl.allow(f"k{i}", 100)
    rl.allow("fresh", 300)
    assert len(rl._hits) < 10
