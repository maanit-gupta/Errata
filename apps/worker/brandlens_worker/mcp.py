"""Read-only MCP server (Round 3, improvement 1): `POST /v1/mcp`, JSON-RPC 2.0 over HTTP.

Gives an AI writing tool (Claude, Cursor, ChatGPT) ONE campaign's approved brand context before it
drafts: active facts and the closest approved rule cards, each with the ID to cite. Guarantees:

- A bearer token resolves (by SHA-256 hash, `resolve_mcp_token`) to one org and one campaign. Tool
  arguments never carry scope; unknown arguments are rejected.
- Facts come from `mcp_campaign_facts` / `match_vault`: not expired, not `never_send`, this campaign
  or org-wide. Rule cards are approved-only and never `never_send`. (pgTAP 03 and 07.)
- There are no write tools, and no draft text is accepted or stored.
- Logs carry IDs, counts and timings only, never the query text or the token.

Transport: MCP "Streamable HTTP" with plain JSON responses (no SSE stream, so GET is 405).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import deque
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import numpy as np
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from brandlens_worker import config

log = logging.getLogger(__name__)

# Newest first. The tools-only surface is identical across these, so we echo the client's version.
SUPPORTED_VERSIONS: tuple[str, ...] = ("2025-11-25", "2025-06-18", "2025-03-26")
SERVER_INFO = {"name": "errata-brand-context", "title": "Errata brand context", "version": "1.0.0"}
INSTRUCTIONS = (
    "Read-only brand context for one campaign. Call get_campaign_facts before stating dates, "
    "venues, fees or rates, and search_brand_rules before drafting copy. Cite the codes you rely "
    "on (e.g. CL-03, E-19). Errata still reviews the final draft; a human approves it."
)

# JSON-RPC error codes.
PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS = -32700, -32600, -32601, -32602
UNAUTHORIZED, RATE_LIMITED, UNAVAILABLE = -32001, -32002, -32000


@dataclass(frozen=True)
class Scope:
    token_id: str
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
        "title": "Campaign facts",
        "description": (
            "Active, approved facts for this campaign plus org-wide facts (dates, venues, fees, "
            "rates, required disclaimers), each with its code to cite. Expired and internal-only "
            "facts are never returned."
        ),
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "search_brand_rules",
        "title": "Search brand rules",
        "description": (
            "The approved brand rule cards and facts closest to a topic, each with its code to "
            "cite and a similarity score. Use before drafting copy on that topic."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": config.MCP_MAX_QUERY_CHARS,
                    "description": "What you are about to write, e.g. 'SIP returns claim'.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": config.MCP_MAX_RESULTS,
                    "default": 5,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RateLimiter:
    """Sliding one-minute window per key. Keys are token ids (only valid tokens get a bucket), and
    empty buckets are dropped, so memory is bounded by the number of live tokens."""

    def __init__(self, per_minute: int = config.MCP_RATE_PER_MINUTE) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float | None = None, *, consume: bool = True) -> bool:
        """True if `key` is under its limit. `consume=False` checks without recording a hit."""
        t = time.monotonic() if now is None else now
        q = self._hits.setdefault(key, deque())
        while q and q[0] <= t - 60:
            q.popleft()
        if len(q) >= self.per_minute:
            return False
        if consume:
            q.append(t)
        self._prune(t)
        return True

    def _prune(self, t: float) -> None:
        if len(self._hits) < 256:
            return
        for k in [k for k, q in self._hits.items() if not q or q[-1] <= t - 60]:
            del self._hits[k]


def _err(rid: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def _ok(rid: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _tool_result(payload: dict[str, Any]) -> dict[str, Any]:
    # JSON-safe copy (dates → ISO strings) for both the text block and structuredContent.
    safe: dict[str, Any] = json.loads(json.dumps(payload, default=_json_default))
    return {
        "content": [{"type": "text", "text": json.dumps(safe, ensure_ascii=False)}],
        "structuredContent": safe,
        "isError": False,
    }


def _json_default(o: Any) -> Any:
    if isinstance(o, datetime):
        return o.isoformat()
    return str(o)


def negotiate_version(requested: Any) -> str:
    return requested if requested in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0]


async def handle_rpc(
    msg: Any, scope: Scope, store: McpStore, embedder: Embeds
) -> dict[str, Any] | None:
    """One JSON-RPC message in, one response out (None for a notification)."""
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
        return _err(None, INVALID_REQUEST, "invalid request")
    method = msg.get("method")
    if not isinstance(method, str):
        return _err(msg.get("id"), INVALID_REQUEST, "invalid request")
    if "id" not in msg:  # notification, e.g. notifications/initialized: no response
        return None
    rid = msg["id"]
    if rid is None or isinstance(rid, bool) or not isinstance(rid, str | int):
        return _err(None, INVALID_REQUEST, "id must be a string or integer")
    params = msg.get("params", {})
    if params is None:
        params = {}
    if not isinstance(params, dict):
        return _err(rid, INVALID_PARAMS, "params must be an object")

    if method == "initialize":
        return _ok(
            rid,
            {
                "protocolVersion": negotiate_version(params.get("protocolVersion")),
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
                "instructions": INSTRUCTIONS,
            },
        )
    if method == "ping":
        return _ok(rid, {})
    if method == "tools/list":
        return _ok(rid, {"tools": TOOLS})
    if method != "tools/call":
        return _err(rid, METHOD_NOT_FOUND, "method not found")

    name = params.get("name")
    args = params.get("arguments", {})
    if args is None:
        args = {}
    if not isinstance(args, dict):
        return _err(rid, INVALID_PARAMS, "arguments must be an object")
    started = time.perf_counter()

    if name == "get_campaign_facts":
        if args:
            return _err(rid, INVALID_PARAMS, "get_campaign_facts takes no arguments")
        facts = await store.active_facts(scope)
        _log_call(scope, "get_campaign_facts", len(facts), started)
        return _ok(
            rid,
            _tool_result(
                {
                    "campaign_id": scope.campaign_id,
                    "as_of": datetime.now(UTC).isoformat(timespec="seconds"),
                    "facts": facts,
                }
            ),
        )

    if name == "search_brand_rules":
        unknown = set(args) - {"query", "limit"}
        if unknown:
            return _err(rid, INVALID_PARAMS, "unknown arguments: " + ", ".join(sorted(unknown)))
        query, limit = args.get("query"), args.get("limit", 5)
        if not isinstance(query, str) or not query.strip():
            return _err(rid, INVALID_PARAMS, "query must be a non-empty string")
        if len(query) > config.MCP_MAX_QUERY_CHARS:
            return _err(rid, INVALID_PARAMS, f"query must be ≤ {config.MCP_MAX_QUERY_CHARS} chars")
        if not isinstance(limit, int) or isinstance(limit, bool):
            return _err(rid, INVALID_PARAMS, "limit must be an integer")
        if not 1 <= limit <= config.MCP_MAX_RESULTS:
            return _err(rid, INVALID_PARAMS, f"limit must be 1-{config.MCP_MAX_RESULTS}")
        # CPU-bound ONNX call: keep it off the event loop the queue consumers share.
        vectors = await asyncio.to_thread(embedder.embed, [query.strip()])
        vec = [float(x) for x in vectors[0]]
        hits = await store.search(scope, vec, limit)
        _log_call(scope, "search_brand_rules", len(hits), started)
        return _ok(rid, _tool_result({"campaign_id": scope.campaign_id, "results": hits}))

    return _err(rid, INVALID_PARAMS, "unknown tool")


def _log_call(scope: Scope, tool: str, n: int, started: float) -> None:
    log.info(
        "mcp tool call",
        extra={
            "token_id": scope.token_id,
            "org_id": scope.org_id,
            "campaign_id": scope.campaign_id,
            "tool": tool,
            "results": n,
            "ms": round((time.perf_counter() - started) * 1000),
        },
    )


class PgMcpStore:
    """Service-role SQL functions only; see migration 20261031100022_mcp_tokens.sql."""

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def resolve(self, token_hash: str) -> Scope | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select token_id::text as t, org_id::text as o, campaign_id::text as c "
                "from public.resolve_mcp_token(%s)",
                (token_hash,),
            )
            row = await cur.fetchone()
        return Scope(row["t"], row["o"], row["c"]) if row else None

    async def active_facts(self, scope: Scope) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select code, kind, statement, value, required_disclaimer, valid_until "
                "from public.mcp_campaign_facts(%s, %s)",
                (scope.org_id, scope.campaign_id),
            )
            return list(await cur.fetchall())

    async def search(
        self, scope: Scope, embedding: Sequence[float], k: int
    ) -> list[dict[str, Any]]:
        from brandlens_worker.embeddings import to_pgvector

        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select code, kind, dimension::text as dimension, title, content, "
                "severity::text as severity, value, round(similarity::numeric, 4)::float as score "
                "from public.match_vault(%s::uuid, %s::uuid, %s::extensions.vector, %s::int)",
                (scope.org_id, scope.campaign_id, to_pgvector(np.asarray(embedding)), k),
            )
            return list(await cur.fetchall())


def build_router() -> APIRouter:
    router = APIRouter()
    limiter = RateLimiter()
    # Bad or missing tokens, per client address: stops junk tokens from turning into DB lookups.
    auth_failures = RateLimiter(per_minute=config.MCP_AUTH_FAILURES_PER_MINUTE)

    @router.post("/v1/mcp")
    async def mcp(request: Request) -> Response:
        services: dict[str, Any] = getattr(request.app.state, "services", {}) or {}
        store: McpStore | None = services.get("mcp_store")
        embedder: Embeds | None = services.get("embedder")
        if store is None or embedder is None:
            return JSONResponse(_err(None, UNAVAILABLE, "MCP unavailable"), status_code=503)

        client = request.client.host if request.client else "unknown"
        if not auth_failures.allow(client, consume=False):
            return JSONResponse(
                _err(None, RATE_LIMITED, "too many failed attempts"),
                status_code=429,
                headers={"Retry-After": "60"},
            )
        auth = request.headers.get("authorization", "")
        token = auth[7:].strip() if auth[:7].lower() == "bearer " else ""
        scope = await store.resolve(hash_token(token)) if token.startswith("ek_") else None
        if scope is None:
            auth_failures.allow(client)
            return JSONResponse(
                _err(None, UNAUTHORIZED, "invalid or revoked token"),
                status_code=401,
                headers={"WWW-Authenticate": 'Bearer realm="errata-mcp"'},
            )
        if not limiter.allow(scope.token_id):
            log.info("mcp rate limited", extra={"token_id": scope.token_id})
            return JSONResponse(
                _err(None, RATE_LIMITED, "rate limit exceeded"),
                status_code=429,
                headers={"Retry-After": "60"},
            )
        header_version = request.headers.get("mcp-protocol-version")
        if header_version is not None and header_version not in SUPPORTED_VERSIONS:
            return JSONResponse(
                _err(None, INVALID_REQUEST, "unsupported MCP-Protocol-Version"), status_code=400
            )

        raw = await request.body()
        if len(raw) > config.MCP_MAX_BODY_BYTES:
            return JSONResponse(_err(None, INVALID_REQUEST, "request too large"), status_code=413)
        try:
            body = json.loads(raw)
        except ValueError:
            return JSONResponse(_err(None, PARSE_ERROR, "parse error"), status_code=400)
        if isinstance(body, list):
            return JSONResponse(
                _err(None, INVALID_REQUEST, "batches are not supported"), status_code=400
            )
        out = await handle_rpc(body, scope, store, embedder)
        if out is None:
            return Response(status_code=202)
        return JSONResponse(out)

    @router.get("/v1/mcp")
    async def mcp_get() -> Response:
        # No server-initiated stream: the spec says answer GET with 405.
        return Response(status_code=405, headers={"Allow": "POST"})

    return router
