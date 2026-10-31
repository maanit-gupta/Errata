# Errata MCP server (read-only)

Round 3, improvement 1. Built from the team's *Shift-Left MCP Server* build spec, **read-only
subset** (team decision, 2026-10-31). An AI writing tool (Cursor, Claude Code, Claude Desktop, any
MCP client) grounds its drafts in the organisation's **live campaign facts, glossary and approved
rule cards**, and pre-checks copy with Errata's own deterministic stage before anything reaches the
review queue. Errata still runs the full review, and a human still approves. Nothing is published,
submitted or changed from an MCP client.

- **Endpoint:** `POST https://<worker-url>/v1/mcp` (MCP Streamable HTTP, JSON responses; no SSE, so
  `GET` returns 405).
- **Protocol versions:** `2025-11-25`, `2025-06-18`, `2025-03-26` (the server echoes the client's).
- **Auth:** `Authorization: Bearer bl_mcp_…`, a personal key that acts with the owner's **current**
  role in one organisation.

## Tools, resource and prompt

| Name | Input | Returns |
|---|---|---|
| `get_campaign_context` (tool) | `campaign_query`, `intent {goal, audience, cta, channel}` | The active campaign it matched, `approved_facts` (live, sendable, this campaign + org-wide, each with `fact_id`, `canonical_value`, `required_disclaimer`, `valid_until`), the 8 most relevant `active_rule_cards`, the `glossary`, the intent contract and a governance directive |
| `precheck_draft_fast` (tool) | `draft_text` (≤ 15,000 chars), `campaign_id`, `intent`, optional `baseline_text` | `BLOCKED` or `PASS_DETERMINISTIC`; rule-cited `findings` (code, quote, span, severity, explanation, suggested fix); the intent check (CTA kept; meaning kept vs `baseline_text` at the calibrated `INTENT_COSINE`); `latency_ms` |
| `verify_claim_evidence` (tool) | `claim_statement` (≤ 500 chars), `campaign_id` | `BLOCKER`, `SUBSTANTIATED_CITE_FACT_AND_DISCLAIMER` or `UNSUBSTANTIATED_NO_MATCHING_FACT`; the deterministic findings on the claim, the nearest live facts, required disclaimers and the governing claims rules |
| `brandvault://campaigns/active` (resource) | none | Every active campaign with its live, sendable facts |
| `brandlens-governed-draft` (prompt) | `campaign_name`, `goal`, `audience`, `cta`, `channel?` | The check-fix loop: context → draft → precheck until it passes → hand over to Errata |

All tools are annotated `readOnlyHint: true` and return the payload both as JSON text and as
`structuredContent`. No tool calls an external LLM: precheck and claim checks run Errata's own
Stage 1 (`ingest`) and Stage 3 (`run_filters`) code, and retrieval is the pipeline's `match_vault`.

## Guarantees, and where each one is tested

| Guarantee | Enforced in | Tests |
|---|---|---|
| Never returns never-send items, expired facts or another campaign's facts | `mcp_campaign_facts()`, `match_vault()` (SQL); precheck/claim findings that cite a never-send item are withheld and only counted | pgTAP `07_mcp_api_keys`, `03_match_vault`; `test_mcp_server.py` plants a never-send fact with the top embedding and asserts it never appears in any response; `mcp_check.py` plants three canaries and checks every returned code against the DB |
| Scope comes only from the key (org, user, role); unknown arguments such as `org_id` or `role` are rejected | `resolve_mcp_key()`, strict Pydantic schemas (`extra="forbid"`) | `test_mcp.py::test_campaign_context_validates`, `test_surface_is_read_only`; `mcp_check.py` calls 11, 15 |
| Agency creators see the same rule view as in the app (`rule_cards_public`): code, dimension, title, summary, severity. No body, examples or source page | `mcp/auth.py::scrub_rule_for_role` | `test_mcp.py::test_agency_key_gets_the_agency_view`, `test_scrubber_matches_the_app_boundary`; `test_mcp_server.py`; `mcp_check.py` call 6 |
| Read-only: no tool writes brand data or workflow state; nothing is submitted or published | `mcp/server.py` exposes three tools, one resource and one prompt | `test_mcp.py::test_surface_is_read_only`; `mcp_check.py` calls 3, 17 |
| Keys: SHA-256 hash only, shown once, unreadable by app users, expire (1–365 days), revocable for good, follow the owner's current role, die with the membership | migration `20261031100022_mcp_api_keys.sql` | pgTAP `07_mcp_api_keys` (29 tests) |
| Every call is audited (key, tool, campaign, counts); logs carry IDs and counts only, never draft or claim text or the key | `mcp/store.py::audit`, `mcp/server.py` | `test_mcp.py::test_logs_and_audit_never_carry_text_or_keys`; `test_mcp_server.py` |
| 60 calls/min per key; 30 failed auths/min per client; 128 KB body cap | `mcp/auth.py`, `config.py` | `test_mcp.py` |
| The PayWise hero caption is caught (CL-03, E-19, F-048, G-07) in < 50 ms; the remediated caption passes | Stage 3, unchanged | `test_mcp_server.py::test_paywise_diwali_sip_mcp_firewall` (build spec §7); `mcp_check.py` calls 8–9 |

**What a key holder sees.** Live fact values and, for staff roles, approved rule card text: the
same snippets the review pipeline sends to its LLM. Treat a key like a password. Keys expire; revoke
one when a laptop or a contractor leaves.

**Limits.** The rate limiter lives in the worker process (one instance on Render). The free-tier
worker sleeps when idle, so the first call after a while can take 30–60 s.
`verify_claim_evidence`'s similarity threshold (`MCP_CLAIM_FACT_MIN_SIM = 0.78`) comes from the
build spec and is **not calibrated on the golden set yet**; deterministic findings decide a
`BLOCKER` first.

## Create a key

**In the app:** Settings → **AI tools (MCP)** → **Connect Claude or Cursor** → name the key, pick an
expiry → **Generate key**. The key and a ready-to-paste config for Cursor, Claude Code or Claude
Desktop are shown once. Your keys are listed underneath with **Revoke**; brand admins see and can
revoke every key in the organisation.

**In SQL (signed in):**

```sql
select * from public.create_mcp_key('<org_id>', 'Cursor', 90);  -- raw_key is returned once
select public.revoke_mcp_key('<key_id>');
```

## Connect a client

Replace `<worker-url>` with the worker's public URL (the Render service URL) and `bl_mcp_…` with
your key.

**Cursor** (`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "errata": {
      "url": "https://<worker-url>/v1/mcp",
      "headers": { "Authorization": "Bearer bl_mcp_…" }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add --transport http errata https://<worker-url>/v1/mcp --header "Authorization: Bearer bl_mcp_…"
```

**Claude Desktop** (`claude_desktop_config.json`; reaches remote servers through the `mcp-remote`
bridge, which needs Node):

```json
{
  "mcpServers": {
    "errata": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<worker-url>/v1/mcp", "--header", "Authorization:${ERRATA_MCP_AUTH}"],
      "env": { "ERRATA_MCP_AUTH": "Bearer bl_mcp_…" }
    }
  }
}
```

**Quick check with curl:**

```bash
curl -s https://<worker-url>/v1/mcp \
  -H "Authorization: Bearer bl_mcp_…" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_campaign_context","arguments":{"campaign_query":"Diwali","intent":{"goal":"webinar sign-ups","audience":"first-time investors","cta":"Register now"}}}}'
```

A good first prompt: use the `brandlens-governed-draft` prompt, or *"Use the errata tools to get
the Diwali SIP campaign context, draft a 40-word Instagram caption for the webinar, pre-check it
until it passes, and list the codes you relied on."*

## Acceptance check (20 calls)

`scripts/mcp_check.py` runs 20 scripted calls and prints a pass/fail table. With `--db-url` (local
database only; it refuses anything else) it plants three canary facts that must never come back
(never-send, expired, other campaign) using a real fact's embedding, mints creator, agency and
already-expired keys, checks every returned fact and rule code against the database, then revokes
the creator key (call 20 must get 401) and deletes everything it created.

```bash
make db-start && make db-reset && make dev-local   # terminal 1 (worker on :8000)
make mcp-check                                     # terminal 2 → apps/worker/eval/mcp_check.md
```

Against a deployed worker with an existing key (no DB checks; calls 6, 19 and 20 are skipped):

```bash
cd apps/worker && uv run python ../../scripts/mcp_check.py --url https://<worker-url> --key bl_mcp_…
```

The latest recorded run is in [`apps/worker/eval/mcp_check.md`](../apps/worker/eval/mcp_check.md),
with a note on exactly what it ran against.

## Differences from the build spec, and why

| Build spec | Built | Why |
|---|---|---|
| Five tools, including `submit_to_brandlens_queue` and `log_rule_feedback` | The three read-only tools, the resource and the prompt | Team decision 2026-10-31: Round 3 promised a read-only server. Submitting stays in Errata, where intent capture, the AI pass and human approval live |
| `worker/app/mcp/*` with FastMCP over SSE, asyncpg, sentence-transformers | `apps/worker/brandlens_worker/mcp/{auth,schemas,store,tools,server}.py`, Streamable HTTP (JSON), psycopg, fastembed | Repo conventions (CLAUDE.md): no torch, one DB driver, no new dependency; SSE is deprecated in the MCP spec |
| `mcp_api_keys.scoped_role` stored on the key; `FOR ALL` RLS policy | Role read from `memberships` at every call; select-only RLS; create/revoke through definer functions; required expiry | The spec's policy let a member mint a `brand_admin` key or un-revoke one; a demoted user's key now demotes too |
| `ALTER PUBLICATION … ADD TABLE contents, versions`; new `never_send` and `source_channel` columns | Not needed | `contents` is already published (the statement would fail the migration); `never_send` already exists; `source_channel` only served the submit tool |
| `verify_claim_evidence` and the resource read facts without a `never_send` filter; agency rules truncated to 160 chars | Every fact read goes through `mcp_campaign_facts()`/`match_vault()`; agencies get the `rule_cards_public` fields | Invariant 5 (never send never-send items to an external LLM); a truncated body still leaks rule text |
| Intent gate at cosine 0.82 against a synthetic baseline | CTA check always; cosine at the calibrated `INTENT_COSINE` (0.74) only against a real `baseline_text` | P14 calibration: 0.82 dropped 6 of 16 good rewrites; a synthetic sentence isn't a meaning baseline |
| Next.js 15 route `/api/mcp-keys`, vermilion "Swiss" modal | Server actions (`lib/mcp/actions.ts`) and `components/settings/mcp-integration.tsx` in DESIGN.md's system | Next 16 server actions carry the same-origin check; one design language |
| Every call increments GCS telemetry | Audit events only | GCS measures reviews of submitted drafts; counting pre-checks would distort it |
