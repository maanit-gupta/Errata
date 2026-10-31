"""MCP server: auth, scoping, protocol shape, input validation, limits and read-only guarantees.

No DB and no model: a fake store and embedder. The SQL side (hash-only storage, revoke, the fact
filter) is covered by supabase/tests/07_mcp_tokens.test.sql; the live check is scripts/mcp_check.py.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from brandlens_worker import config
from brandlens_worker.mcp import (
    SUPPORTED_VERSIONS,
    RateLimiter,
    Scope,
    build_router,
    hash_token,
)

SCOPE = Scope("tok-1", "org-1", "camp-1")
GOOD = "ek_good"
SECRET_QUERY = "draft about guaranteed 12% returns for Ravi"


class FakeStore:
    def __init__(self) -> None:
        self.facts: list[dict[str, Any]] = [{"code": "E-19", "statement": "Diwali webinar"}]
        self.search_calls: list[tuple[Scope, int, int]] = []
        self.resolve_calls = 0

    async def resolve(self, token_hash: str) -> Scope | None:
        self.resolve_calls += 1
        return SCOPE if token_hash == hash_token(GOOD) else None

    async def active_facts(self, scope: Scope) -> list[dict[str, Any]]:
        assert scope == SCOPE
        return self.facts

    async def search(
        self, scope: Scope, embedding: Sequence[float], k: int
    ) -> list[dict[str, Any]]:
        self.search_calls.append((scope, k, len(embedding)))
        return [{"code": "CL-03", "kind": "rule", "title": "No guaranteed returns"}][:k]


class FakeEmbedder:
    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [[0.1] * 384 for _ in texts]


@pytest.fixture
def ctx() -> tuple[TestClient, FakeStore]:
    app = FastAPI()
    store = FakeStore()
    app.state.services = {"mcp_store": store, "embedder": FakeEmbedder()}
    app.include_router(build_router())
    return TestClient(app), store


def rpc(
    c: TestClient,
    method: str,
    params: dict[str, Any] | None = None,
    token: str = GOOD,
    rid: Any = 1,
) -> Any:
    body: dict[str, Any] = {"jsonrpc": "2.0", "id": rid, "method": method}
    if params is not None:
        body["params"] = params
    return c.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {token}"})


def call(c: TestClient, tool: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {"name": tool}
    if args is not None:
        params["arguments"] = args
    out: dict[str, Any] = rpc(c, "tools/call", params).json()
    return out


# --- auth and transport ----------------------------------------------------------------------


def test_rejects_missing_wrong_and_malformed_tokens(ctx: tuple[TestClient, FakeStore]) -> None:
    c, store = ctx
    assert c.post("/v1/mcp", json={}).status_code == 401
    assert rpc(c, "ping", token="ek_wrong").status_code == 401
    res = c.post("/v1/mcp", json={}, headers={"Authorization": "Basic ek_good"})
    assert res.status_code == 401
    assert res.headers["www-authenticate"].startswith("Bearer")
    # Tokens without the ek_ prefix never reach the database.
    before = store.resolve_calls
    assert rpc(c, "ping", token="not-a-token").status_code == 401
    assert store.resolve_calls == before


def test_failed_auth_is_rate_limited_per_client(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    for _ in range(config.MCP_AUTH_FAILURES_PER_MINUTE):
        assert rpc(c, "ping", token="ek_bad").status_code == 401
    assert rpc(c, "ping", token="ek_bad").status_code == 429


def test_token_rate_limit_returns_429(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    for _ in range(config.MCP_RATE_PER_MINUTE):
        assert rpc(c, "ping").status_code == 200
    res = rpc(c, "ping")
    assert res.status_code == 429
    assert res.headers["retry-after"] == "60"


def test_get_is_405_and_batches_are_rejected(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    assert c.get("/v1/mcp").status_code == 405
    batch = [{"jsonrpc": "2.0", "id": 1, "method": "ping"}]
    res = c.post("/v1/mcp", json=batch, headers={"Authorization": f"Bearer {GOOD}"})
    assert res.status_code == 400


def test_parse_error_and_oversized_body(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    h = {"Authorization": f"Bearer {GOOD}", "content-type": "application/json"}
    assert c.post("/v1/mcp", content=b"{nope", headers=h).json()["error"]["code"] == -32700
    big = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping", "pad": "x" * 40_000})
    assert c.post("/v1/mcp", content=big, headers=h).status_code == 413


def test_unsupported_protocol_header_is_400(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    h = {"Authorization": f"Bearer {GOOD}", "MCP-Protocol-Version": "1999-01-01"}
    res = c.post("/v1/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"}, headers=h)
    assert res.status_code == 400
    h["MCP-Protocol-Version"] = SUPPORTED_VERSIONS[1]
    res = c.post("/v1/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"}, headers=h)
    assert res.status_code == 200


def test_unavailable_without_services() -> None:
    app = FastAPI()
    app.include_router(build_router())
    res = TestClient(app).post("/v1/mcp", json={}, headers={"Authorization": f"Bearer {GOOD}"})
    assert res.status_code == 503


# --- protocol ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("asked", "expected"),
    [("2025-06-18", "2025-06-18"), ("2025-03-26", "2025-03-26"), ("2099-01-01", "2025-11-25")],
)
def test_initialize_negotiates_version(
    ctx: tuple[TestClient, FakeStore], asked: str, expected: str
) -> None:
    c, _ = ctx
    res = rpc(c, "initialize", {"protocolVersion": asked, "capabilities": {}}).json()["result"]
    assert res["protocolVersion"] == expected
    assert res["serverInfo"]["name"] == "errata-brand-context"
    assert res["capabilities"] == {"tools": {"listChanged": False}}


def test_tool_list_is_read_only(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    tools = rpc(c, "tools/list").json()["result"]["tools"]
    assert {t["name"] for t in tools} == {"get_campaign_facts", "search_brand_rules"}
    assert all(t["annotations"]["readOnlyHint"] for t in tools)
    for t in tools:  # scope is never an input
        assert not {"org_id", "campaign_id"} & set(t["inputSchema"]["properties"])


def test_notification_gets_202_and_no_body(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    res = c.post(
        "/v1/mcp",
        json={"jsonrpc": "2.0", "method": "notifications/initialized"},
        headers={"Authorization": f"Bearer {GOOD}"},
    )
    assert res.status_code == 202
    assert res.content == b""


@pytest.mark.parametrize(
    "body",
    [
        {"jsonrpc": "1.0", "id": 1, "method": "ping"},
        {"jsonrpc": "2.0", "id": 1},
        {"jsonrpc": "2.0", "id": None, "method": "ping"},
        {"jsonrpc": "2.0", "id": {"x": 1}, "method": "ping"},
        "ping",
    ],
)
def test_invalid_requests(ctx: tuple[TestClient, FakeStore], body: Any) -> None:
    c, _ = ctx
    res = c.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {GOOD}"})
    assert res.json()["error"]["code"] == -32600


def test_params_and_arguments_must_be_objects(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": ["x"]}
    res = c.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {GOOD}"}).json()
    assert res["error"]["code"] == -32602
    res = rpc(c, "tools/call", {"name": "search_brand_rules", "arguments": "q"}).json()
    assert res["error"]["code"] == -32602


# --- tools ---------------------------------------------------------------------------------------


def test_get_campaign_facts_returns_token_scope(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    res = call(c, "get_campaign_facts")["result"]
    payload = json.loads(res["content"][0]["text"])
    assert payload == res["structuredContent"]
    assert payload["campaign_id"] == "camp-1"
    assert [f["code"] for f in payload["facts"]] == ["E-19"]
    assert res["isError"] is False


def test_get_campaign_facts_rejects_arguments(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    assert call(c, "get_campaign_facts", {"campaign_id": "other"})["error"]["code"] == -32602


def test_search_uses_only_the_token_scope(ctx: tuple[TestClient, FakeStore]) -> None:
    c, store = ctx
    res = call(c, "search_brand_rules", {"query": "guaranteed returns", "limit": 3})
    assert json.loads(res["result"]["content"][0]["text"])["results"][0]["code"] == "CL-03"
    assert store.search_calls == [(SCOPE, 3, 384)]
    # Trying to pick another campaign or org is an error, not silently ignored.
    for extra in ({"campaign_id": "other"}, {"org_id": "evil"}):
        res = call(c, "search_brand_rules", {"query": "x", **extra})
        assert res["error"]["code"] == -32602
    assert len(store.search_calls) == 1


@pytest.mark.parametrize(
    "args",
    [
        {},
        {"query": ""},
        {"query": "   "},
        {"query": 42},
        {"query": "x" * (config.MCP_MAX_QUERY_CHARS + 1)},
        {"query": "ok", "limit": 0},
        {"query": "ok", "limit": config.MCP_MAX_RESULTS + 1},
        {"query": "ok", "limit": True},
        {"query": "ok", "limit": "5"},
    ],
)
def test_search_validates_input(ctx: tuple[TestClient, FakeStore], args: dict[str, Any]) -> None:
    c, store = ctx
    assert call(c, "search_brand_rules", args)["error"]["code"] == -32602
    assert store.search_calls == []


def test_no_write_tool_or_method(ctx: tuple[TestClient, FakeStore]) -> None:
    c, _ = ctx
    for tool in ("create_fact", "update_rule", "submit_draft"):
        assert call(c, tool, {})["error"]["code"] == -32602
    for method in ("resources/write", "resources/list", "prompts/get", "sampling/createMessage"):
        assert rpc(c, method).json()["error"]["code"] == -32601


def test_logs_ids_and_counts_never_query_or_token(
    ctx: tuple[TestClient, FakeStore], caplog: pytest.LogCaptureFixture
) -> None:
    c, _ = ctx
    with caplog.at_level(logging.INFO, logger="brandlens_worker.mcp"):
        call(c, "search_brand_rules", {"query": SECRET_QUERY})
    rec = next(r for r in caplog.records if r.getMessage() == "mcp tool call")
    assert rec.__dict__["token_id"] == "tok-1" and rec.__dict__["results"] == 1
    dumped = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert "Ravi" not in dumped and "guaranteed" not in dumped
    assert GOOD not in dumped and hash_token(GOOD) not in dumped


# --- limiter -------------------------------------------------------------------------------------


def test_rate_limit_window() -> None:
    rl = RateLimiter(per_minute=2)
    assert rl.allow("t", 0) and rl.allow("t", 1)
    assert not rl.allow("t", 2)
    assert rl.allow("t", 61)


def test_rate_limiter_check_without_consuming() -> None:
    rl = RateLimiter(per_minute=1)
    assert rl.allow("t", 0, consume=False)
    assert rl.allow("t", 0)
    assert not rl.allow("t", 1, consume=False)


def test_rate_limiter_drops_idle_keys() -> None:
    rl = RateLimiter(per_minute=5)
    for i in range(300):
        rl.allow(f"k{i}", 0)
    rl.allow("fresh", 120)
    assert len(rl._hits) < 10
