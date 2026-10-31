"""Build spec §7 golden set: the PayWise Diwali SIP scenario through the real MCP endpoint, the
real PgMcpStore and SQL functions, and the real deterministic pipeline. Read-only subset: the spec's
submit step is replaced by verify_claim_evidence and a precheck of the remediated draft.

Needs a database with every migration and seed.sql applied; skipped unless TEST_DATABASE_URL is
set (CI runs it in the pgtap job). Embeddings use a fixed stand-in so retrieval is deterministic.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from collections.abc import AsyncIterator, Sequence
from typing import Any

import httpx
import numpy as np
import pytest
from fastapi import FastAPI

from brandlens_worker.mcp import PgMcpStore, build_router

DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="set TEST_DATABASE_URL (see module docstring)")

ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
CREATOR = "10000000-0000-4000-8000-000000000002"
AGENCY = "10000000-0000-4000-8000-000000000003"
INTENT = {
    "goal": "webinar sign-ups",
    "audience": "first-time investors",
    "cta": "Register now",
    "channel": "instagram_caption",
}
FLAWED = (
    "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured "
    "annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh! Register now"
)
REMEDIATED = (
    "This Diwali, explore our Flexi-Cap fund on PayWise (3-yr historical CAGR 14.2%, Q3 2026; 1% "
    "exit load within 365 days). Join our online Diwali Wealth Webinar on Oct 28 at 7:00 PM IST. "
    "Register now. Mutual Fund investments are subject to market risks, read all scheme related "
    "documents carefully."
)
CANARY = "CANARY never-send pytest"


class UnitEmbedder:
    def embed(self, texts: Sequence[str]) -> Any:
        out = np.zeros((len(texts), 384), dtype=np.float32)
        out[:, 0] = 1.0
        return out


@pytest.fixture
async def env() -> AsyncIterator[tuple[httpx.AsyncClient, dict[str, str], Any]]:
    from brandlens_worker.db import create_pool

    pool = create_pool(DB or "", max_size=4)
    await pool.open()
    tag = secrets.token_hex(4)
    keys = {who: "bl_mcp_" + secrets.token_hex(24) for who in ("creator", "agency", "expired")}
    e0 = "[" + ",".join("1" if i == 0 else "0" for i in range(384)) + "]"
    async with pool.connection() as conn:
        await conn.execute(
            "update public.rule_cards set embedding = %s::extensions.vector where org_id = %s",
            (e0, ORG),
        )
        await conn.execute(
            "update public.facts set embedding = %s::extensions.vector where org_id = %s",
            (e0, ORG),
        )
        # A never-send fact on this campaign with the same embedding: it would rank first if any
        # filter broke.
        await conn.execute(
            "insert into public.facts (org_id, campaign_id, code, kind, statement, never_send, "
            "embedding) values (%s, %s, %s, 'rate', %s, true, %s::extensions.vector)",
            (ORG, DIWALI, f"NS-{tag}", f"{CANARY}: 14.2% assured returns", e0),
        )
        for who, raw in keys.items():
            await conn.execute(
                "insert into public.mcp_api_keys (org_id, user_id, name, key_prefix, key_hash, "
                "expires_at) values (%s, %s, %s, %s, %s, now() + %s::interval)",
                (
                    ORG,
                    AGENCY if who == "agency" else CREATOR,
                    f"pytest {tag} {who}",
                    raw[:11],
                    hashlib.sha256(raw.encode()).hexdigest(),
                    "-1 minute" if who == "expired" else "1 day",
                ),
            )
    app = FastAPI()
    app.state.services = {"mcp_store": PgMcpStore(pool), "embedder": UnitEmbedder()}
    app.include_router(build_router())
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    yield client, keys, pool
    await client.aclose()
    async with pool.connection() as conn:
        await conn.execute("delete from public.facts where code = %s", (f"NS-{tag}",))
        await conn.execute(
            "delete from public.mcp_api_keys where name like %s", (f"pytest {tag}%",)
        )
    await pool.close()


async def call(client: httpx.AsyncClient, key: str, tool: str, args: dict[str, Any]) -> Any:
    res = await client.post(
        "/v1/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/call",
              "params": {"name": tool, "arguments": args}},
        headers={"Authorization": f"Bearer {key}"},
    )  # fmt: skip
    assert res.status_code == 200, res.text
    body = res.json()
    assert CANARY not in res.text  # never-send text never leaves, whatever the tool
    return body["result"]["structuredContent"]


async def test_paywise_diwali_sip_mcp_firewall(env: Any) -> None:
    client, keys, pool = env
    key = keys["creator"]

    # 1. Grounding: active Diwali SIP facts, nothing expired, nothing from Navratri.
    ctx = await call(
        client, key, "get_campaign_context", {"campaign_query": "Diwali SIP", "intent": INTENT}
    )
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select code from public.facts where org_id = %s and not never_send "
            "and (campaign_id is null or campaign_id = %s) "
            "and (valid_until is null or valid_until > now())",
            (ORG, DIWALI),
        )
        live = {r["code"] for r in await cur.fetchall()}
    fact_codes = {f["fact_id"] for f in ctx["approved_facts"]}
    assert fact_codes == live
    assert {"F-048", "F-112"} <= fact_codes and "E-11" not in fact_codes
    assert ("E-19" in fact_codes) == ("E-19" in live)  # E-19 is live until the campaign ends
    assert ctx["active_rule_cards"] and all("rule" in r for r in ctx["active_rule_cards"])
    campaign_id = ctx["campaign"]["id"]
    assert campaign_id == DIWALI

    # 2. Fast pre-check on the flawed draft: CL-03, E-19, F-048, G-07, in under 50 ms.
    pre = await call(client, key, "precheck_draft_fast",
                     {"draft_text": FLAWED, "campaign_id": campaign_id, "intent": INTENT})  # fmt: skip
    pre = await call(client, key, "precheck_draft_fast",  # second call: warm, as in use
                     {"draft_text": FLAWED, "campaign_id": campaign_id, "intent": INTENT})  # fmt: skip
    assert pre["status"] == "BLOCKED"
    assert pre["latency_ms"] < 50.0, pre["latency_ms"]
    assert {"CL-03", "E-19", "F-048", "G-07"} <= {f["code"] for f in pre["findings"]}

    # 3. Read-only replacement for the spec's submit step: the claim alone is a blocker, and the
    #    remediated draft passes the deterministic checks.
    claim = await call(client, key, "verify_claim_evidence",
                       {"claim_statement": "14.2% assured annual returns", "campaign_id": campaign_id})  # fmt: skip
    assert claim["verdict"] == "BLOCKER"
    ok = await call(client, key, "precheck_draft_fast",
                    {"draft_text": REMEDIATED, "campaign_id": campaign_id, "intent": INTENT})  # fmt: skip
    assert ok["status"] == "PASS_DETERMINISTIC" and ok["findings"] == []

    # Every call is audited with IDs and counts only.
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select event from public.audit_events where event->>'type' = 'mcp_tool' "
            "and event->>'key_id' in (select id::text from public.mcp_api_keys where key_hash = %s)",
            (hashlib.sha256(key.encode()).hexdigest(),),
        )
        events = [r["event"] for r in await cur.fetchall()]
    assert len(events) == 5
    assert "Chandigarh" not in json.dumps(events)


async def test_agency_key_sees_the_agency_view(env: Any) -> None:
    client, keys, _ = env
    ctx = await call(client, keys["agency"], "get_campaign_context",
                     {"campaign_query": "Diwali", "intent": INTENT})  # fmt: skip
    for card in ctx["active_rule_cards"]:
        assert set(card) == {"code", "dimension", "severity", "title", "summary"}


async def test_resource_and_dead_keys(env: Any) -> None:
    client, keys, _ = env
    res = await client.post(
        "/v1/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "resources/read",
              "params": {"uri": "brandvault://campaigns/active"}},
        headers={"Authorization": f"Bearer {keys['creator']}"},
    )  # fmt: skip
    assert res.status_code == 200 and CANARY not in res.text and "E-11" not in res.text
    for bad in (keys["expired"], "bl_mcp_" + "0" * 48):
        r = await client.post(
            "/v1/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
            headers={"Authorization": f"Bearer {bad}"},
        )  # fmt: skip
        assert r.status_code == 401
