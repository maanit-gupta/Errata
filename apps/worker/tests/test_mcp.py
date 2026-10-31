"""MCP server: auth, scoping, protocol shape and read-only guarantees. No DB, no model."""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from brandlens_worker.mcp import (
    MAX_RESULTS,
    RateLimiter,
    Scope,
    build_router,
    hash_token,
)

SCOPE = Scope("org-1", "camp-1")
GOOD = "ek_good"


class FakeStore:
    def __init__(self) -> None:
        self.facts = [{"code": "E-19", "statement": "Diwali event on Oct 31"}]
        self.search_calls: list[tuple[Scope, int]] = []

    async def resolve(self, token_hash: str) -> Scope | None:
        return SCOPE if token_hash == hash_token(GOOD) else None

    async def active_facts(self, scope: Scope) -> list[dict[str, Any]]:
        assert scope == SCOPE
        return self.facts

    async def search(
        self, scope: Scope, embedding: Sequence[float], k: int
    ) -> list[dict[str, Any]]:
        self.search_calls.append((scope, k))
        return [{"code": "CL-03", "kind": "rule", "title": "No guaranteed returns"}][:k]


class FakeEmbedder:
    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [[0.1] * 384 for _ in texts]


@pytest.fixture
def client() -> tuple[TestClient, FakeStore]:
    app = FastAPI()
    store = FakeStore()
    app.state.services = {"mcp_store": store, "embedder": FakeEmbedder()}
    app.include_router(build_router())
    return TestClient(app), store


def rpc(client: TestClient, method: str, params: dict[str, Any] | None = None, token: str = GOOD):
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}
    return client.post("/v1/mcp", json=body, headers={"Authorization": f"Bearer {token}"})


def test_rejects_missing_and_unknown_tokens(client: tuple[TestClient, FakeStore]) -> None:
    c, _ = client
    assert c.post("/v1/mcp", json={}).status_code == 401
    assert rpc(c, "ping", token="ek_wrong").status_code == 401


def test_initialize_and_tool_list_are_read_only(client: tuple[TestClient, FakeStore]) -> None:
    c, _ = client
    init = rpc(c, "initialize").json()["result"]
    assert init["serverInfo"]["name"] == "errata-brand-context"
    names = {t["name"] for t in rpc(c, "tools/list").json()["result"]["tools"]}
    assert names == {"get_campaign_facts", "search_brand_rules"}


def test_notification_gets_202(client: tuple[TestClient, FakeStore]) -> None:
    c, _ = client
    res = c.post(
        "/v1/mcp",
        json={"jsonrpc": "2.0", "method": "notifications/initialized"},
        headers={"Authorization": f"Bearer {GOOD}"},
    )
    assert res.status_code == 202


def test_get_campaign_facts_returns_scoped_facts(client: tuple[TestClient, FakeStore]) -> None:
    c, _ = client
    res = rpc(c, "tools/call", {"name": "get_campaign_facts"}).json()["result"]
    payload = json.loads(res["content"][0]["text"])
    assert payload["campaign_id"] == "camp-1"
    assert [f["code"] for f in payload["facts"]] == ["E-19"]


def test_search_uses_the_token_scope_never_caller_input(
    client: tuple[TestClient, FakeStore],
) -> None:
    c, store = client
    args = {"query": "guaranteed returns", "limit": 3, "campaign_id": "other", "org_id": "evil"}
    res = rpc(c, "tools/call", {"name": "search_brand_rules", "arguments": args})
    assert "error" not in res.json()
    # Unknown arguments are ignored; the store only ever sees the token's scope.
    assert store.search_calls == [(SCOPE, 3)]


@pytest.mark.parametrize(
    "args",
    [
        {},
        {"query": ""},
        {"query": "x" * 501},
        {"query": "ok", "limit": 0},
        {"query": "ok", "limit": MAX_RESULTS + 1},
        {"query": "ok", "limit": True},
    ],
)
def test_search_validates_input(client: tuple[TestClient, FakeStore], args: dict[str, Any]) -> None:
    c, store = client
    res = rpc(c, "tools/call", {"name": "search_brand_rules", "arguments": args}).json()
    assert res["error"]["code"] == -32602
    assert store.search_calls == []


def test_no_write_tool_exists(client: tuple[TestClient, FakeStore]) -> None:
    c, _ = client
    res = rpc(c, "tools/call", {"name": "create_fact", "arguments": {}}).json()
    assert res["error"]["code"] == -32602
    assert rpc(c, "resources/write").json()["error"]["code"] == -32601


def test_rate_limit_window() -> None:
    rl = RateLimiter(per_minute=2)
    assert rl.allow("t", 0) and rl.allow("t", 1)
    assert not rl.allow("t", 2)
    assert rl.allow("t", 61)
