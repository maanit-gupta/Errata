"""`POST /v1/mcp`: MCP over Streamable HTTP with plain JSON responses (no SSE stream; GET is 405).

Read-only by design (Round 3 promise): three tools, one resource, one prompt, nothing that writes
brand data or workflow state. The only writes are audit events (IDs and counts) and the key's
last_used_at. Auth is a `bl_mcp_` bearer key; scope (org, user, role) comes only from the key.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from brandlens_worker import config
from brandlens_worker.mcp import tools
from brandlens_worker.mcp.auth import KEY_PREFIX, McpAuth, RateLimiter, hash_key
from brandlens_worker.mcp.schemas import (
    GetCampaignContextInput,
    PrecheckDraftFastInput,
    VerifyClaimEvidenceInput,
    input_schema,
)
from brandlens_worker.mcp.store import McpStore

log = logging.getLogger(__name__)

# Newest first. This tools/resources/prompts surface is the same in each, so we echo the client's.
SUPPORTED_VERSIONS: tuple[str, ...] = ("2025-11-25", "2025-06-18", "2025-03-26")
SERVER_INFO = {
    "name": "errata-brand-governance",
    "title": "Errata brand governance",
    "version": "2.0.0",
}
INSTRUCTIONS = (
    "Pre-publication brand governance for one organisation (read-only). Always call "
    "get_campaign_context before drafting campaign copy, and run precheck_draft_fast before "
    "showing any promotional draft. Every flag cites an approved rule or fact code (e.g. CL-03, "
    "E-19); cite them too. Errata still runs the full review and a human approves; nothing is "
    "published here."
)

PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS = -32700, -32600, -32601, -32602
UNAUTHORIZED, RATE_LIMITED, UNAVAILABLE = -32001, -32002, -32000

ToolFn = Callable[[Any, McpAuth, McpStore, Any], Awaitable[dict[str, Any]]]
TOOLS: dict[str, tuple[type[BaseModel], ToolFn, str, str]] = {
    "get_campaign_context": (
        GetCampaignContextInput,
        tools.get_campaign_context,
        "Campaign context",
        "Active campaign facts (live, sendable), glossary and the most relevant approved rule "
        "cards for a campaign and intent, so you never invent dates, venues, fees or banned terms.",
    ),
    "precheck_draft_fast": (
        PrecheckDraftFastInput,
        tools.precheck_draft_fast,
        "Pre-check a draft",
        "Errata's deterministic checks (glossary, Fact Vault dates/venues/fees/rates, claims "
        "lexicon, tone heuristics) plus a local CTA and meaning check. No LLM, milliseconds. "
        "Returns BLOCKED or PASS_DETERMINISTIC with rule-cited findings and fixes.",
    ),
    "verify_claim_evidence": (
        VerifyClaimEvidenceInput,
        tools.verify_claim_evidence,
        "Verify a claim",
        "Checks one numeric or promotional claim against the Fact Vault and the claims rules; "
        "returns a verdict, the facts to cite and any required disclaimers.",
    ),
}


def _tool_list() -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "title": title,
            "description": desc,
            "inputSchema": input_schema(model),
            "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False},
        }
        for name, (model, _, title, desc) in TOOLS.items()
    ]


def _err(rid: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def _ok(rid: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _json_safe(payload: Any) -> Any:
    return json.loads(json.dumps(payload, default=str))


def _tool_result(payload: dict[str, Any], *, error: bool = False) -> dict[str, Any]:
    safe = _json_safe(payload)
    return {
        "content": [{"type": "text", "text": json.dumps(safe, ensure_ascii=False)}],
        "structuredContent": safe,
        "isError": error,
    }


def _validation_message(exc: ValidationError) -> str:
    # Field paths and reasons only; never echo the caller's input back.
    parts = [
        f"{'.'.join(str(p) for p in e['loc']) or 'arguments'}: {e['msg']}" for e in exc.errors()
    ]
    return "invalid arguments: " + "; ".join(parts[:5])


def negotiate_version(requested: Any) -> str:
    return requested if requested in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0]


async def handle_rpc(msg: Any, auth: McpAuth, store: McpStore, embed: Any) -> dict[str, Any] | None:
    """One JSON-RPC message in, one response out (None for a notification)."""
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
        return _err(None, INVALID_REQUEST, "invalid request")
    method = msg.get("method")
    if not isinstance(method, str):
        return _err(msg.get("id"), INVALID_REQUEST, "invalid request")
    if "id" not in msg:  # notification, e.g. notifications/initialized
        return None
    rid = msg["id"]
    if rid is None or isinstance(rid, bool) or not isinstance(rid, str | int):
        return _err(None, INVALID_REQUEST, "id must be a string or integer")
    params = msg.get("params", {})
    params = {} if params is None else params
    if not isinstance(params, dict):
        return _err(rid, INVALID_PARAMS, "params must be an object")

    if method == "initialize":
        return _ok(
            rid,
            {
                "protocolVersion": negotiate_version(params.get("protocolVersion")),
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"listChanged": False, "subscribe": False},
                    "prompts": {"listChanged": False},
                },
                "serverInfo": SERVER_INFO,
                "instructions": INSTRUCTIONS,
            },
        )
    if method == "ping":
        return _ok(rid, {})
    if method == "tools/list":
        return _ok(rid, {"tools": _tool_list()})
    if method == "resources/list":
        return _ok(
            rid,
            {
                "resources": [
                    {
                        "uri": tools.ACTIVE_CAMPAIGNS_URI,
                        "name": "active-campaigns",
                        "title": "Active campaigns and their facts",
                        "description": "Every active campaign with its live, sendable facts.",
                        "mimeType": "application/json",
                    }
                ]
            },
        )
    if method == "resources/templates/list":
        return _ok(rid, {"resourceTemplates": []})
    if method == "resources/read":
        if params.get("uri") != tools.ACTIVE_CAMPAIGNS_URI:
            return _err(rid, -32002, "resource not found")
        data = await tools.read_active_campaigns(auth, store)
        return _ok(
            rid,
            {
                "contents": [
                    {
                        "uri": tools.ACTIVE_CAMPAIGNS_URI,
                        "mimeType": "application/json",
                        "text": json.dumps(_json_safe(data), ensure_ascii=False),
                    }
                ]
            },
        )
    if method == "prompts/list":
        return _ok(
            rid,
            {
                "prompts": [
                    {
                        "name": tools.PROMPT_NAME,
                        "title": "Governed draft",
                        "description": "Draft on-brand copy with Errata's check-fix loop.",
                        "arguments": tools.PROMPT_ARGS,
                    }
                ]
            },
        )
    if method == "prompts/get":
        if params.get("name") != tools.PROMPT_NAME:
            return _err(rid, INVALID_PARAMS, "unknown prompt")
        pargs = params.get("arguments") or {}
        required = [str(a["name"]) for a in tools.PROMPT_ARGS if a["required"]]
        if not isinstance(pargs, dict) or any(
            not isinstance(pargs.get(k), str) or not pargs[k].strip() or len(pargs[k]) > 200
            for k in required
        ):
            return _err(rid, INVALID_PARAMS, "arguments: " + ", ".join(required) + " (1-200 chars)")
        text = tools.governed_draft_prompt({k: str(v)[:200] for k, v in pargs.items()})
        return _ok(
            rid,
            {
                "description": "Errata governed draft",
                "messages": [{"role": "user", "content": {"type": "text", "text": text}}],
            },
        )
    if method != "tools/call":
        return _err(rid, METHOD_NOT_FOUND, "method not found")

    name = params.get("name")
    entry = TOOLS.get(name) if isinstance(name, str) else None
    if entry is None:
        return _err(rid, INVALID_PARAMS, "unknown tool")
    model, fn, _, _ = entry
    raw_args = params.get("arguments", {})
    raw_args = {} if raw_args is None else raw_args
    if not isinstance(raw_args, dict):
        return _err(rid, INVALID_PARAMS, "arguments must be an object")
    try:
        args = model.model_validate(raw_args)
    except ValidationError as exc:
        return _err(rid, INVALID_PARAMS, _validation_message(exc))

    started = time.perf_counter()
    try:
        result = await fn(args, auth, store, embed)
        error = False
    except tools.ToolError as exc:
        result, error = {"error": str(exc)}, True
    log.info(
        "mcp tool call",
        extra={
            "key_id": auth.key_id,
            "org_id": auth.org_id,
            "role": auth.role,
            "tool": name,
            "error": error,
            "ms": round((time.perf_counter() - started) * 1000),
        },
    )
    return _ok(rid, _tool_result(result, error=error))


def build_router() -> APIRouter:
    router = APIRouter()
    limiter = RateLimiter()
    # Bad or missing keys, per client address: stops junk keys from turning into DB lookups.
    auth_failures = RateLimiter(per_minute=config.MCP_AUTH_FAILURES_PER_MINUTE)

    @router.post("/v1/mcp")
    async def mcp(request: Request) -> Response:
        services: dict[str, Any] = getattr(request.app.state, "services", {}) or {}
        store: McpStore | None = services.get("mcp_store")
        embedder = services.get("embedder")
        if store is None or embedder is None:
            return JSONResponse(_err(None, UNAVAILABLE, "MCP unavailable"), status_code=503)

        client = request.client.host if request.client else "unknown"
        if not auth_failures.allow(client, consume=False):
            return JSONResponse(
                _err(None, RATE_LIMITED, "too many failed attempts"),
                status_code=429,
                headers={"Retry-After": "60"},
            )
        header = request.headers.get("authorization", "")
        raw = header[7:].strip() if header[:7].lower() == "bearer " else ""
        auth = await store.resolve(hash_key(raw)) if raw.startswith(KEY_PREFIX) else None
        if auth is None:
            auth_failures.allow(client)
            return JSONResponse(
                _err(None, UNAUTHORIZED, "MCP key invalid, expired or revoked"),
                status_code=401,
                headers={"WWW-Authenticate": 'Bearer realm="errata-mcp"'},
            )
        if not limiter.allow(auth.key_id):
            log.info("mcp rate limited", extra={"key_id": auth.key_id})
            return JSONResponse(
                _err(None, RATE_LIMITED, "rate limit exceeded"),
                status_code=429,
                headers={"Retry-After": "60"},
            )
        version = request.headers.get("mcp-protocol-version")
        if version is not None and version not in SUPPORTED_VERSIONS:
            return JSONResponse(
                _err(None, INVALID_REQUEST, "unsupported MCP-Protocol-Version"), status_code=400
            )
        body_bytes = await request.body()
        if len(body_bytes) > config.MCP_MAX_BODY_BYTES:
            return JSONResponse(_err(None, INVALID_REQUEST, "request too large"), status_code=413)
        try:
            body = json.loads(body_bytes)
        except ValueError:
            return JSONResponse(_err(None, PARSE_ERROR, "parse error"), status_code=400)
        if isinstance(body, list):
            return JSONResponse(
                _err(None, INVALID_REQUEST, "batches are not supported"), status_code=400
            )
        out = await handle_rpc(body, auth, store, embedder.embed)
        if out is None:
            return Response(status_code=202)
        return JSONResponse(out)

    @router.get("/v1/mcp")
    async def mcp_get() -> Response:
        # No server-initiated stream: the spec says answer GET with 405.
        return Response(status_code=405, headers={"Allow": "POST"})

    return router
