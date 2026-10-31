"""Read-only MCP server (Round 3, improvement 1): `POST /v1/mcp`, JSON-RPC 2.0 over HTTP.

Grounds an AI writing tool (Claude, Cursor, ChatGPT) in ONE campaign's approved brand context:
active facts and the top-k approved rule cards. Rules enforced here and in SQL:

- a bearer token resolves (by SHA-256 hash) to one org and one campaign; nothing else is reachable;
- facts are returned only when `valid_until` is null or in the future, and never when `never_send`;
- rule cards are approved-only and never `never_send`;
- there are no write tools, and drafts are never accepted.
"""

from __future__ import annotations

import hashlib
import logging
import time
from collections import defaultdict, deque
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)

PROTOCOL_VERSION = "2025-03-26"
MAX_RESULTS = 10
RATE_PER_MINUTE = 60
MAX_QUERY_CHARS = 500


@dataclass(frozen=True)
class Scope:
    org_id: str
    campaign_id: str


class McpStore(Protocol):
    async def resolve(self, token_hash: str) -> Scope | None: ...
    async def active_facts(self, scope: Scope) -> list[dict[str, Any]]: ...
    async def search(
        self, scope: Scope, embedding: Sequence[float], k: int
    ) -> list[dict[str, Any]]: ...


class Embeds(Protocol):
    def embed(self, texts: Sequence[str]) -> Any: ...


TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_campaign_facts",
        "description": (
            "Active facts for this campaign (dates, venues, fees, required disclaimers). "
            "Expired and never-send facts are excluded."
        ),
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "search_brand_rules",
        "description": (
            "Top approved brand rule cards and facts relevant to a topic, each with its ID "
            "to cite. Use before drafting copy."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "maxLength": MAX_QUERY_CHARS},
                "limit": {"type": "integer", "minimum": 1, "maximum": MAX_RESULTS, "default": 5},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RateLimiter:
    def __init__(self, per_minute: int = RATE_PER_MINUTE) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        t = time.monotonic() if now is None else now
        q = self._hits[key]
        while q and q[0] <= t - 60:
            q.popleft()
        if len(q) >= self.per_minute:
            return False
        q.append(t)
        return True


def _err(rid: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def _ok(rid: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _text(payload: Any) -> dict[str, Any]:
    import json

    return {"content": [{"type": "text", "text": json.dumps(payload, default=str)}]}


async def handle_rpc(
    msg: Any, scope: Scope, store: McpStore, embedder: Embeds
) -> dict[str, Any] | None:
    """One JSON-RPC message in, one response out (None for notifications)."""
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or "method" not in msg:
        return _err(None, -32600, "invalid request")
    rid, method = msg.get("id"), msg["method"]
    params = msg.get("params") or {}
    if rid is None:  # notification, e.g. notifications/initialized
        return None
    if method == "initialize":
        return _ok(
            rid,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "errata-brand-context", "version": "1"},
            },
        )
    if method == "ping":
        return _ok(rid, {})
    if method == "tools/list":
        return _ok(rid, {"tools": TOOLS})
    if method != "tools/call":
        return _err(rid, -32601, f"method not found: {method}")

    name, args = params.get("name"), params.get("arguments") or {}
    if name == "get_campaign_facts":
        facts = await store.active_facts(scope)
        log.info("mcp get_campaign_facts", extra={"facts": len(facts)})
        return _ok(rid, _text({"campaign_id": scope.campaign_id, "facts": facts}))
    if name == "search_brand_rules":
        query = args.get("query")
        limit = args.get("limit", 5)
        if not isinstance(query, str) or not query.strip() or len(query) > MAX_QUERY_CHARS:
            return _err(rid, -32602, f"query must be 1-{MAX_QUERY_CHARS} characters")
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= MAX_RESULTS:
            return _err(rid, -32602, f"limit must be 1-{MAX_RESULTS}")
        vec = [float(x) for x in embedder.embed([query])[0]]
        hits = await store.search(scope, vec, limit)
        log.info("mcp search_brand_rules", extra={"results": len(hits)})
        return _ok(rid, _text({"results": hits}))
    return _err(rid, -32602, f"unknown tool: {name}")


class PgMcpStore:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def resolve(self, token_hash: str) -> Scope | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select org_id::text as o, campaign_id::text as c "
                "from public.resolve_mcp_token(%s)",
                (token_hash,),
            )
            row = await cur.fetchone()
        return Scope(row["o"], row["c"]) if row else None

    async def active_facts(self, scope: Scope) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select code, kind::text as kind, statement, value, required_disclaimer, "
                "valid_until from public.facts "
                "where org_id = %s and (campaign_id is null or campaign_id = %s) "
                "and (valid_until is null or valid_until > now()) and not never_send "
                "order by code",
                (scope.org_id, scope.campaign_id),
            )
            return list(await cur.fetchall())

    async def search(
        self, scope: Scope, embedding: Sequence[float], k: int
    ) -> list[dict[str, Any]]:
        vec = "[" + ",".join(f"{x:.6f}" for x in embedding) + "]"
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select code, kind, title, content, severity::text as severity, value, "
                "round(similarity::numeric, 4) as similarity "
                "from public.match_vault(%s::uuid, %s::uuid, %s::extensions.vector, %s::int)",
                (scope.org_id, scope.campaign_id, vec, k),
            )
            return list(await cur.fetchall())


def build_router() -> APIRouter:
    router = APIRouter()
    limiter = RateLimiter()

    @router.post("/v1/mcp")
    async def mcp(request: Request) -> Response:
        services = request.app.state.services
        store: McpStore | None = services.get("mcp_store")
        embedder: Embeds | None = services.get("embedder")
        if store is None or embedder is None:
            return JSONResponse(_err(None, -32000, "MCP unavailable"), status_code=503)
        auth = request.headers.get("authorization", "")
        token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        scope = await store.resolve(hash_token(token)) if token else None
        if scope is None:
            return JSONResponse(
                _err(None, -32001, "invalid or revoked token"),
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not limiter.allow(hash_token(token)):
            return JSONResponse(_err(None, -32002, "rate limit exceeded"), status_code=429)
        try:
            body = await request.json()
        except ValueError:
            return JSONResponse(_err(None, -32700, "parse error"), status_code=400)
        if isinstance(body, list):
            return JSONResponse(_err(None, -32600, "batches are not supported"), status_code=400)
        out = await handle_rpc(body, scope, store, embedder)
        if out is None:
            return Response(status_code=202)
        return JSONResponse(out)

    return router
