"""Round 3 acceptance check for the read-only MCP server: 20 scripted calls, pass/fail table.

"Done" means: every call behaves as specified, every fact returned is unexpired and belongs to the
token's campaign (or is org-wide), and no never-send text ever comes back.

LOCAL STACK ONLY when --db-url is given: the script then
  1. plants three "canary" facts that must never be returned (never-send, expired, other campaign),
     copying a real fact's embedding so they would rank first if the filters failed;
  2. creates a Diwali-campaign token directly in the DB (hash only);
  3. runs the 20 calls, checking every returned code against the DB;
  4. revokes the token (call 20 proves a revoked token is refused) and deletes the canaries.

Usage (worker running locally on :8000, local Supabase up):
  cd apps/worker && eval "$(../../scripts/local-supabase-env.sh)" && \\
    uv run python ../../scripts/mcp_check.py --url http://localhost:8000 --db-url "$DATABASE_URL"
Against any stack with an existing token (no DB checks, no canaries):
  uv run python ../../scripts/mcp_check.py --url https://<worker> --token ek_...
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import secrets
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
NAVRATRI = "20000000-0000-4000-8000-000000000002"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}

QUERIES = [
    "guaranteed returns on SIP",
    "Diwali webinar date and venue",
    "exit load on redemption",
    "historical CAGR claim with disclaimer",
    "warm tone, no hype",
    "logo clear space and colours",
    "Navratri investor meet Hall B Chandigarh",  # expired fact E-11 must not come back
    "internal only canary never send",  # aimed straight at the never-send canary
    "mutual fund risk disclaimer",
    "festive playful copy about money",
]


@dataclass
class Row:
    n: int
    call: str
    expect: str
    got: str
    ok: bool


class Checker:
    def __init__(self, url: str, token: str, db: Any | None, canaries: set[str]) -> None:
        self.url = url.rstrip("/") + "/v1/mcp"
        self.token = token
        self.db = db
        self.canaries = canaries
        self.rows: list[Row] = []
        self.http = httpx.Client(timeout=60)
        self.facts_seen = 0

    # --- transport -------------------------------------------------------------------------
    def post(self, body: Any, token: str | None = None) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {token or self.token}",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-06-18",
        }
        return self.http.post(self.url, json=body, headers=headers)

    def rpc(self, method: str, params: dict[str, Any] | None = None, **kw: Any) -> httpx.Response:
        body: dict[str, Any] = {"jsonrpc": "2.0", "id": len(self.rows) + 1, "method": method}
        if params is not None:
            body["params"] = params
        return self.post(body, **kw)

    def record(self, call: str, expect: str, got: str, ok: bool) -> None:
        self.rows.append(Row(len(self.rows) + 1, call, expect, got, ok))

    # --- content checks --------------------------------------------------------------------
    def leaks(self, payload: Any) -> list[str]:
        """Problems with the items in a tool result: canaries, expired, wrong campaign, never-send."""
        text = json.dumps(payload)
        problems = [f"canary {c} returned" for c in self.canaries if c in text]
        if "CANARY" in text:
            problems.append("canary text returned")
        items = payload.get("facts") or payload.get("results") or []
        now = datetime.now(UTC)
        for it in items:
            if it.get("kind", "fact") != "rule":
                self.facts_seen += 1
                vu = it.get("valid_until")
                if vu and datetime.fromisoformat(vu) <= now:
                    problems.append(f"{it['code']} expired")
            if self.db is not None:
                problems += self.db_check(it)
        return problems

    def db_check(self, it: dict[str, Any]) -> list[str]:
        assert self.db is not None
        if it.get("kind") == "rule":
            row = self.db.execute(
                "select status::text, never_send from public.rule_cards "
                "where org_id = %s and code = %s and status = 'approved'",
                (ORG, it["code"]),
            ).fetchone()
            if row is None:
                return [f"{it['code']} is not an approved rule"]
            return [f"{it['code']} is never_send"] if row[1] else []
        row = self.db.execute(
            "select campaign_id::text, never_send, valid_until is null or valid_until > now() "
            "from public.facts where org_id = %s and code = %s",
            (ORG, it["code"]),
        ).fetchone()
        if row is None:
            return [f"{it['code']} not in vault"]
        out = []
        if row[0] not in (None, DIWALI):
            out.append(f"{it['code']} belongs to another campaign")
        if row[1]:
            out.append(f"{it['code']} is never_send")
        if not row[2]:
            out.append(f"{it['code']} expired")
        return out

    def tool(self, call: str, name: str, args: dict[str, Any] | None = None) -> None:
        params: dict[str, Any] = {"name": name}
        if args is not None:
            params["arguments"] = args
        res = self.rpc("tools/call", params)
        try:
            payload = res.json()["result"]["structuredContent"]
        except (KeyError, ValueError):
            self.record(
                call, "200 + scoped result", f"HTTP {res.status_code} {res.text[:80]}", False
            )
            return
        problems = self.leaks(payload)
        n = len(payload.get("facts") or payload.get("results") or [])
        codes = ",".join(i["code"] for i in (payload.get("facts") or payload.get("results") or []))
        got = f"{n} items [{codes}]" + (f" PROBLEMS: {'; '.join(problems)}" if problems else "")
        ok = res.status_code == 200 and not problems and payload.get("campaign_id") == DIWALI
        self.record(call, "only live, in-scope, sendable items", got, ok)

    def error(self, call: str, res: httpx.Response, status: int, code: int | None) -> None:
        got_code = None
        with contextlib.suppress(ValueError):
            got_code = res.json().get("error", {}).get("code")
        ok = res.status_code == status and (code is None or got_code == code)
        self.record(
            call,
            f"HTTP {status}" + (f", {code}" if code else ""),
            f"HTTP {res.status_code}, {got_code}",
            ok,
        )

    # --- the 20 calls ----------------------------------------------------------------------
    def run(self, revoke: Any | None) -> None:
        res = self.rpc(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "mcp_check", "version": "1"},
            },
        )
        info = res.json().get("result", {}) if res.status_code == 200 else {}
        self.record(
            "initialize",
            "2025-06-18 + tools capability",
            f"{info.get('protocolVersion')} {list(info.get('capabilities', {}))}",
            info.get("protocolVersion") == "2025-06-18" and "tools" in info.get("capabilities", {}),
        )

        res = self.post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self.record(
            "notifications/initialized",
            "HTTP 202",
            f"HTTP {res.status_code}",
            res.status_code == 202,
        )

        res = self.rpc("tools/list")
        names = sorted(t["name"] for t in res.json().get("result", {}).get("tools", []))
        self.record(
            "tools/list",
            "exactly the 2 read-only tools",
            ",".join(names),
            names == ["get_campaign_facts", "search_brand_rules"],
        )

        self.tool("get_campaign_facts", "get_campaign_facts")
        for q in QUERIES:
            self.tool(
                f"search_brand_rules '{q[:28]}'", "search_brand_rules", {"query": q, "limit": 10}
            )

        self.error(
            "search with campaign_id=Navratri",
            self.rpc(
                "tools/call",
                {
                    "name": "search_brand_rules",
                    "arguments": {"query": "event", "campaign_id": NAVRATRI},
                },
            ),
            200,
            -32602,
        )
        self.error(
            "search limit=11",
            self.rpc(
                "tools/call",
                {"name": "search_brand_rules", "arguments": {"query": "event", "limit": 11}},
            ),
            200,
            -32602,
        )
        self.error(
            "write tool create_fact",
            self.rpc("tools/call", {"name": "create_fact", "arguments": {"code": "X"}}),
            200,
            -32602,
        )
        self.error(
            "get_campaign_facts with campaign_id=Navratri",
            self.rpc(
                "tools/call", {"name": "get_campaign_facts", "arguments": {"campaign_id": NAVRATRI}}
            ),
            200,
            -32602,
        )
        self.error(
            "unknown token", self.rpc("ping", token="ek_" + secrets.token_hex(24)), 401, -32001
        )
        if revoke is not None:
            revoke()
            self.error(
                "revoked token", self.rpc("tools/call", {"name": "get_campaign_facts"}), 401, -32001
            )
        else:
            res = self.rpc("ping")
            self.record("ping", "HTTP 200", f"HTTP {res.status_code}", res.status_code == 200)


def is_local(db_url: str) -> bool:
    return (urlparse(db_url).hostname or "") in LOCAL_HOSTS


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000", help="worker base URL")
    ap.add_argument("--token", help="existing ek_ token (skips DB setup)")
    ap.add_argument("--db-url", help="LOCAL database URL: plant canaries, mint + revoke a token")
    ap.add_argument("--out", type=Path, help="also write the table as Markdown here")
    a = ap.parse_args()
    if not a.token and not a.db_url:
        ap.error("pass --token, or --db-url for the local stack")

    db = None
    token = a.token
    canaries: set[str] = set()
    cleanup: list[Any] = []
    revoke = None
    if a.db_url:
        if not is_local(a.db_url):
            print("refusing: --db-url must point at a local database (it writes test rows)")
            return 2
        import psycopg

        db = psycopg.connect(a.db_url, autocommit=True)
        tag = secrets.token_hex(4).upper()
        plants = [
            (f"MCPCHECK-NS-{tag}", DIWALI, "never_send", "true", "null"),
            (f"MCPCHECK-OLD-{tag}", DIWALI, "expired", "false", "now() - interval '1 day'"),
            (f"MCPCHECK-OTHER-{tag}", NAVRATRI, "other campaign", "false", "null"),
        ]
        for code, camp, why, ns, vu in plants:
            db.execute(
                "insert into public.facts (org_id, campaign_id, code, kind, statement, never_send, "
                f"valid_until, embedding) select %s, %s, %s, 'other', %s, {ns}, {vu}, "
                "(select embedding from public.facts where org_id = %s and embedding is not null "
                "order by code limit 1)",
                (ORG, camp, code, f"CANARY {why} internal only canary never send {code}", ORG),
            )
            canaries.add(code)
        cleanup.append(
            lambda: db.execute(
                "delete from public.facts where code like %s", (f"MCPCHECK-%-{tag}",)
            )
        )
        if token is None:
            token = "ek_" + secrets.token_hex(24)
            h = hashlib.sha256(token.encode()).hexdigest()
            tid = db.execute(
                "insert into public.mcp_tokens (org_id, campaign_id, label, token_hash) "
                "values (%s, %s, %s, %s) returning id",
                (ORG, DIWALI, f"mcp_check {tag}", h),
            ).fetchone()[0]
            revoke = lambda: db.execute(  # noqa: E731
                "update public.mcp_tokens set revoked_at = now() where id = %s", (tid,)
            )
            cleanup.append(
                lambda: db.execute("delete from public.mcp_tokens where id = %s", (tid,))
            )
        embedded = db.execute(
            "select (select count(*) from public.rule_cards where org_id = %s and embedding is not null)"
            " + (select count(*) from public.facts where org_id = %s and embedding is not null)",
            (ORG, ORG),
        ).fetchone()[0]
        print(
            f"vault rows with embeddings: {embedded} (0 means search returns nothing; run the worker's vault job)"
        )

    assert token is not None
    started = time.perf_counter()
    chk = Checker(a.url, token, db, canaries)
    try:
        chk.run(revoke)
    finally:
        for fn in cleanup:
            fn()
    secs = time.perf_counter() - started

    lines = ["| # | Call | Expected | Got | Pass |", "|---|---|---|---|---|"]
    for r in chk.rows:
        lines.append(f"| {r.n} | {r.call} | {r.expect} | {r.got} | {'PASS' if r.ok else 'FAIL'} |")
    passed = sum(r.ok for r in chk.rows)
    summary = (
        f"{passed}/{len(chk.rows)} calls passed in {secs:.1f} s; {chk.facts_seen} fact items "
        f"checked{' against the DB' if db else ''}; canaries planted: {len(canaries)}"
    )
    print("\n".join(lines))
    print(summary)
    if a.out:
        stamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        a.out.write_text(
            f"# MCP check ({stamp})\n\nTarget: `{a.url}`\n\n"
            + "\n".join(lines)
            + f"\n\n**{summary}**\n"
        )
    return 0 if passed == len(chk.rows) == 20 else 1


if __name__ == "__main__":
    sys.exit(main())
