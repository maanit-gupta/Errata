"""Round 3 acceptance check for the read-only MCP server: 20 scripted calls, pass/fail table.

"Done" (README): every call behaves as specified, every fact returned is live and belongs to the
requested campaign (or is org-wide), and no never-send text ever comes back.

LOCAL STACK ONLY when --db-url is given. The script then
  1. plants three canary facts that must never be returned (never-send, expired, other campaign),
     copying a real fact's embedding so they would rank first if a filter failed;
  2. mints three keys directly in the DB (hash only): creator, agency creator, already expired;
  3. runs the 20 calls, checking every returned fact and rule code against the DB;
  4. revokes the creator key (call 20 proves a revoked key is refused) and deletes everything it
     created.

Usage (worker running locally on :8000, local Supabase up):
  make mcp-check
Against any stack with an existing key (no DB checks, no canaries; calls that need the extra keys
are reported as skipped):
  cd apps/worker && uv run python ../../scripts/mcp_check.py --url https://<worker> --key bl_mcp_...
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import secrets
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
NAVRATRI = "20000000-0000-4000-8000-000000000002"
CREATOR = "10000000-0000-4000-8000-000000000002"
AGENCY = "10000000-0000-4000-8000-000000000003"
OTHER_ORG_CAMPAIGN = "99999999-0000-4000-8000-000000000001"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}
INTENT = {"goal": "webinar sign-ups", "audience": "first-time investors", "cta": "Register now"}
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
RULE_KEYS_AGENCY = {"code", "dimension", "severity", "title", "summary"}

Check = Callable[[dict[str, Any]], str | None]


@dataclass
class Row:
    n: int
    call: str
    expect: str
    got: str
    ok: bool | None  # None = skipped


class Checker:
    def __init__(self, url: str, keys: dict[str, str], db: Any | None, canaries: set[str]) -> None:
        self.url = url.rstrip("/") + "/v1/mcp"
        self.keys = keys
        self.db = db
        self.canaries = canaries
        self.rows: list[Row] = []
        self.http = httpx.Client(timeout=90)
        self.items_checked = 0

    # --- transport -----------------------------------------------------------------------------
    def post(self, body: Any, key: str | None) -> httpx.Response:
        headers = {
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-06-18",
        }
        if key:
            headers["Authorization"] = f"Bearer {key}"
        return self.http.post(self.url, json=body, headers=headers)

    def rpc(
        self, method: str, params: dict[str, Any] | None = None, who: str = "creator"
    ) -> httpx.Response:
        body: dict[str, Any] = {"jsonrpc": "2.0", "id": len(self.rows) + 1, "method": method}
        if params is not None:
            body["params"] = params
        return self.post(body, self.keys.get(who))

    def call_tool(self, name: str, args: dict[str, Any], who: str = "creator") -> httpx.Response:
        return self.rpc("tools/call", {"name": name, "arguments": args}, who)

    def record(self, call: str, expect: str, got: str, ok: bool | None) -> None:
        self.rows.append(Row(len(self.rows) + 1, call, expect, got, ok))

    # --- content checks ------------------------------------------------------------------------
    def leaks(self, text: str, payload: Any) -> list[str]:
        """Problems in a response: canaries, expired or out-of-scope facts, non-approved rules."""
        problems = [f"canary {c} returned" for c in self.canaries if c in text]
        if "CANARY" in text:
            problems.append("canary text returned")
        if not isinstance(payload, dict):
            return problems
        facts = list(payload.get("approved_facts") or []) + list(
            payload.get("matching_facts") or []
        )
        for c in payload.get("campaigns") or []:
            facts += c.get("approved_facts") or []
        rules = list(payload.get("active_rule_cards") or [])
        rules += payload.get("governing_claim_rules") or []
        scope = {c["id"] for c in payload.get("campaigns") or []} or {DIWALI}
        now = datetime.now(UTC)
        for f in facts:
            self.items_checked += 1
            vu = f.get("valid_until")
            if vu and datetime.fromisoformat(vu) <= now:
                problems.append(f"{f['fact_id']} expired")
            if self.db is not None:
                problems += self.db_fact(f["fact_id"], scope)
        for r in rules:
            self.items_checked += 1
            if self.db is not None:
                problems += self.db_rule(r["code"])
        return problems

    def db_fact(self, code: str, scope: set[str]) -> list[str]:
        assert self.db is not None
        row = self.db.execute(
            "select campaign_id::text, never_send, valid_until is null or valid_until > now() "
            "from public.facts where org_id = %s and code = %s",
            (ORG, code),
        ).fetchone()
        if row is None:
            return [f"{code} not in vault"]
        out = []
        if row[0] is not None and row[0] not in scope:
            out.append(f"{code} belongs to another campaign")
        if row[1]:
            out.append(f"{code} is never_send")
        if not row[2]:
            out.append(f"{code} expired")
        return out

    def db_rule(self, code: str) -> list[str]:
        assert self.db is not None
        row = self.db.execute(
            "select never_send from public.rule_cards "
            "where org_id = %s and code = %s and status = 'approved'",
            (ORG, code),
        ).fetchone()
        if row is None:
            return [f"{code} is not an approved rule"]
        return [f"{code} is never_send"] if row[0] else []

    def tool(
        self,
        call: str,
        expect: str,
        name: str,
        args: dict[str, Any],
        check: Check,
        who: str = "creator",
    ) -> None:
        if who not in self.keys:
            self.record(call, expect, f"skipped: no {who} key (needs --db-url)", None)
            return
        res = self.call_tool(name, args, who)
        try:
            result = res.json()["result"]
            payload = result["structuredContent"]
        except (KeyError, ValueError):
            self.record(call, expect, f"HTTP {res.status_code} {res.text[:80]}", False)
            return
        problems = self.leaks(res.text, payload)
        msg = check(result)
        if msg:
            problems.append(msg)
        summary = (
            payload.get("status")
            or payload.get("verdict")
            or payload.get("error")
            or (
                f"{len(payload.get('approved_facts', []))} facts, "
                f"{len(payload.get('active_rule_cards', []))} rules"
            )
        )
        got = str(summary)[:90] + (f" PROBLEMS: {'; '.join(problems)}" if problems else "")
        self.record(call, expect, got, res.status_code == 200 and not problems)

    def error(self, call: str, res: httpx.Response, status: int, code: int) -> None:
        got_code = None
        with contextlib.suppress(ValueError):
            got_code = res.json().get("error", {}).get("code")
        ok = res.status_code == status and got_code == code
        self.record(call, f"HTTP {status}, {code}", f"HTTP {res.status_code}, {got_code}", ok)

    # --- the 20 calls --------------------------------------------------------------------------
    def run(self, revoke: Callable[[], None] | None) -> None:
        # 1-4: protocol
        res = self.rpc(
            "initialize",
            {"protocolVersion": "2025-06-18", "capabilities": {},
             "clientInfo": {"name": "mcp_check", "version": "2"}},
        )  # fmt: skip
        info = res.json().get("result", {}) if res.status_code == 200 else {}
        caps = sorted(info.get("capabilities", {}))
        self.record(
            "initialize", "2025-06-18; tools, resources, prompts",
            f"{info.get('protocolVersion')} {caps}",
            info.get("protocolVersion") == "2025-06-18" and caps == ["prompts", "resources", "tools"],
        )  # fmt: skip

        res = self.post(
            {"jsonrpc": "2.0", "method": "notifications/initialized"}, self.keys["creator"]
        )
        self.record("notifications/initialized", "HTTP 202", f"HTTP {res.status_code}",
                    res.status_code == 202)  # fmt: skip

        tools = self.rpc("tools/list").json().get("result", {}).get("tools", [])
        names = sorted(t["name"] for t in tools)
        read_only = all(t.get("annotations", {}).get("readOnlyHint") for t in tools)
        self.record(
            "tools/list", "exactly the 3 read-only tools", ",".join(names),
            names == ["get_campaign_context", "precheck_draft_fast", "verify_claim_evidence"]
            and read_only,
        )  # fmt: skip

        res = self.rpc(
            "prompts/get",
            {"name": "brandlens-governed-draft",
             "arguments": {"campaign_name": "Diwali SIP 2026", "goal": "sign-ups",
                           "audience": "new investors", "cta": "Register now"}},
        )  # fmt: skip
        self.record(
            "prompts/get brandlens-governed-draft", "the check-fix loop, no submit tool",
            f"HTTP {res.status_code}",
            res.status_code == 200 and "precheck_draft_fast" in res.text
            and "submit_to_brandlens_queue" not in res.text,
        )  # fmt: skip

        # 5-7: get_campaign_context
        def diwali_facts(r: dict[str, Any]) -> str | None:
            codes = {f["fact_id"] for f in r["structuredContent"].get("approved_facts", [])}
            ok = {"F-048", "F-112"} <= codes and "E-11" not in codes
            return None if ok else f"facts {sorted(codes)}"

        def agency_view(r: dict[str, Any]) -> str | None:
            cards = r["structuredContent"].get("active_rule_cards", [])
            bad = [c["code"] for c in cards if set(c) - RULE_KEYS_AGENCY]
            return f"agency saw full rule text for {bad}" if bad else None

        def tool_error(r: dict[str, Any]) -> str | None:
            return None if r.get("isError") else "expected a tool error"

        self.tool("get_campaign_context 'Diwali SIP'", "live Diwali + org-wide facts, approved rules",
                  "get_campaign_context", {"campaign_query": "Diwali SIP", "intent": INTENT},
                  diwali_facts)  # fmt: skip
        self.tool("get_campaign_context as agency creator", "rule summaries only",
                  "get_campaign_context", {"campaign_query": "Diwali", "intent": INTENT},
                  agency_view, who="agency")  # fmt: skip
        self.tool("get_campaign_context 'Navratri' (ended)", "tool error, no facts",
                  "get_campaign_context", {"campaign_query": "Navratri", "intent": INTENT},
                  tool_error)  # fmt: skip

        # 8-11: precheck_draft_fast
        def blocked_four(r: dict[str, Any]) -> str | None:
            p = r["structuredContent"]
            codes = {f["code"] for f in p.get("findings", [])}
            if p.get("status") != "BLOCKED" or not {"CL-03", "E-19", "F-048", "G-07"} <= codes:
                return f"status {p.get('status')}, codes {sorted(codes)}"
            return None

        def passes(r: dict[str, Any]) -> str | None:
            p = r["structuredContent"]
            return (
                None if p.get("status") == "PASS_DETERMINISTIC" else f"findings {p.get('findings')}"
            )

        def cta_missing(r: dict[str, Any]) -> str | None:
            reason = r["structuredContent"].get("intent_verification", {}).get("failure_reason")
            return None if reason == "cta_missing" else f"intent {reason}"

        self.tool("precheck the flawed hero caption", "BLOCKED: CL-03, E-19, F-048, G-07",
                  "precheck_draft_fast",
                  {"draft_text": FLAWED, "campaign_id": DIWALI, "intent": INTENT}, blocked_four)  # fmt: skip
        self.tool("precheck the remediated draft", "PASS_DETERMINISTIC", "precheck_draft_fast",
                  {"draft_text": REMEDIATED, "campaign_id": DIWALI, "intent": INTENT}, passes)  # fmt: skip
        self.tool("precheck without the CTA", "BLOCKED: cta_missing", "precheck_draft_fast",
                  {"draft_text": REMEDIATED.replace("Register now. ", ""), "campaign_id": DIWALI,
                   "intent": INTENT}, cta_missing)  # fmt: skip
        self.tool("precheck on another org's campaign", "tool error (not found)",
                  "precheck_draft_fast",
                  {"draft_text": FLAWED, "campaign_id": OTHER_ORG_CAMPAIGN, "intent": INTENT},
                  tool_error)  # fmt: skip

        # 12-13: verify_claim_evidence
        def blocker(r: dict[str, Any]) -> str | None:
            verdict = r["structuredContent"].get("verdict")
            return None if verdict == "BLOCKER" else str(verdict)

        self.tool("verify_claim '14.2% assured annual returns'", "BLOCKER", "verify_claim_evidence",
                  {"claim_statement": "14.2% assured annual returns", "campaign_id": DIWALI},
                  blocker)  # fmt: skip
        self.tool("verify_claim aimed at the canaries", "no canary or out-of-scope fact",
                  "verify_claim_evidence",
                  {"claim_statement": "internal only canary never send rate", "campaign_id": DIWALI},
                  lambda r: None)  # fmt: skip

        # 14: resource
        res = self.rpc("resources/read", {"uri": "brandvault://campaigns/active"})
        try:
            data = json.loads(res.json()["result"]["contents"][0]["text"])
            problems = self.leaks(res.text, data)
            got = f"{len(data['campaigns'])} campaigns" + (
                f" PROBLEMS: {problems}" if problems else ""
            )
            self.record("resources/read campaigns/active", "live, sendable facts only", got,
                        not problems)  # fmt: skip
        except (KeyError, ValueError, IndexError):
            self.record("resources/read campaigns/active", "live, sendable facts only",
                        f"HTTP {res.status_code}", False)  # fmt: skip

        # 15-17: input validation and the read-only surface
        self.error("get_campaign_context with an org_id argument",
                   self.call_tool("get_campaign_context",
                                  {"campaign_query": "Diwali", "intent": INTENT, "org_id": ORG}),
                   200, -32602)  # fmt: skip
        self.error("precheck with a 15,001-char draft",
                   self.call_tool("precheck_draft_fast",
                                  {"draft_text": "x" * 15_001, "campaign_id": DIWALI, "intent": INTENT}),
                   200, -32602)  # fmt: skip
        self.error("write tool submit_to_brandlens_queue",
                   self.call_tool("submit_to_brandlens_queue", {}), 200, -32602)  # fmt: skip

        # 18-20: dead keys
        self.error("unknown key", self.post({"jsonrpc": "2.0", "id": 1, "method": "ping"},
                                            "bl_mcp_" + secrets.token_hex(24)), 401, -32001)  # fmt: skip
        if "expired" in self.keys:
            self.error("expired key", self.rpc("ping", who="expired"), 401, -32001)
        else:
            self.record("expired key", "HTTP 401, -32001", "skipped: needs --db-url", None)
        if revoke is not None:
            revoke()
            self.error("revoked key", self.rpc("ping"), 401, -32001)
        else:
            self.record("revoked key", "HTTP 401, -32001", "skipped: needs --db-url", None)


def is_local(db_url: str) -> bool:
    return (urlparse(db_url).hostname or "") in LOCAL_HOSTS


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000", help="worker base URL")
    ap.add_argument("--key", help="existing bl_mcp_ key (skips DB setup)")
    ap.add_argument("--db-url", help="LOCAL database URL: plant canaries, mint and revoke keys")
    ap.add_argument("--out", type=Path, help="also write the table as Markdown here")
    a = ap.parse_args()
    if not a.key and not a.db_url:
        ap.error("pass --key, or --db-url for the local stack")

    db = None
    keys: dict[str, str] = {}
    canaries: set[str] = set()
    cleanup: list[Callable[[], Any]] = []
    revoke = None
    if a.key:
        keys["creator"] = a.key
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
                f"valid_until, embedding) select %s, %s, %s, 'rate', %s, {ns}, {vu}, "
                "(select embedding from public.facts where org_id = %s and embedding is not null "
                "order by code limit 1)",
                (ORG, camp, code, f"CANARY {why} internal only canary never send rate {code}", ORG),
            )
            canaries.add(code)
        cleanup.append(
            lambda: db.execute(
                "delete from public.facts where code like %s", (f"MCPCHECK-%-{tag}",)
            )
        )
        ids: dict[str, Any] = {}
        for who, user, ttl in (
            ("creator", CREATOR, "1 day"),
            ("agency", AGENCY, "1 day"),
            ("expired", CREATOR, "-1 minute"),
        ):
            if who == "creator" and a.key:
                continue
            raw = "bl_mcp_" + secrets.token_hex(24)
            ids[who] = db.execute(
                "insert into public.mcp_api_keys (org_id, user_id, name, key_prefix, key_hash, "
                "expires_at) values (%s, %s, %s, %s, %s, now() + %s::interval) returning id",
                (ORG, user, f"mcp_check {tag} {who}", raw[:11],
                 hashlib.sha256(raw.encode()).hexdigest(), ttl),
            ).fetchone()[0]  # fmt: skip
            keys[who] = raw
        if "creator" in ids:
            revoke = lambda: db.execute(  # noqa: E731
                "update public.mcp_api_keys set revoked_at = now() where id = %s", (ids["creator"],)
            )
        cleanup.append(
            lambda: db.execute(
                "delete from public.mcp_api_keys where name like %s", (f"mcp_check {tag}%",)
            )
        )
        embedded = db.execute(
            "select (select count(*) from public.rule_cards where org_id = %s and embedding is not "
            "null) + (select count(*) from public.facts where org_id = %s and embedding is not null)",
            (ORG, ORG),
        ).fetchone()[0]
        print(
            f"vault rows with embeddings: {embedded} (0 means retrieval returns nothing; let the "
            "worker's embed_vault job run first)"
        )

    started = time.perf_counter()
    chk = Checker(a.url, keys, db, canaries)
    try:
        chk.run(revoke)
    finally:
        for fn in cleanup:
            fn()
    secs = time.perf_counter() - started

    lines = ["| # | Call | Expected | Got | Result |", "|---|---|---|---|---|"]
    for r in chk.rows:
        verdict = "SKIP" if r.ok is None else ("PASS" if r.ok else "FAIL")
        lines.append(f"| {r.n} | {r.call} | {r.expect} | {r.got} | {verdict} |")
    passed = sum(1 for r in chk.rows if r.ok)
    skipped = sum(1 for r in chk.rows if r.ok is None)
    summary = (
        f"{passed}/{len(chk.rows)} calls passed ({skipped} skipped) in {secs:.1f} s; "
        f"{chk.items_checked} returned facts/rules checked{' against the DB' if db else ''}; "
        f"canaries planted: {len(canaries)}"
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
