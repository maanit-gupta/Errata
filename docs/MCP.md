# Errata MCP server (read-only)

Round 3, improvement 1. An AI writing tool (Cursor, Claude Code, Claude Desktop, any MCP client)
can ask Errata for **one campaign's approved brand context** before it drafts, instead of guessing
dates, fees or tone. Errata still reviews the finished draft, and a human still approves it.

- **Endpoint:** `POST https://<worker-url>/v1/mcp` (MCP Streamable HTTP, JSON responses, no SSE).
- **Protocol versions:** `2025-11-25`, `2025-06-18`, `2025-03-26` (the server echoes the client's).
- **Auth:** `Authorization: Bearer ek_…`. One token = one org + one campaign.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `get_campaign_facts` | none | Every live fact for the token's campaign plus org-wide facts: `code` (cite it), `kind`, `statement`, `value`, `required_disclaimer`, `valid_until` |
| `search_brand_rules` | `query` (1–500 chars), `limit` (1–10, default 5) | The closest approved rule cards and facts: `code`, `kind` (`rule`/`fact`), `dimension`, `title`, `content`, `severity`, `score` |

Both return the payload as a JSON text block and as `structuredContent`. Both are annotated
`readOnlyHint: true`.

## What it guarantees, and where each guarantee is tested

| Guarantee | Enforced in | Test |
|---|---|---|
| A token reaches one org and one campaign; scope never comes from arguments, and unknown arguments (e.g. `campaign_id`) are rejected | `mcp.py`, `resolve_mcp_token()` | `test_mcp.py::test_search_uses_only_the_token_scope`, `scripts/mcp_check.py` calls 15, 18 |
| No expired facts, no other campaign's facts, nothing marked never-send | `mcp_campaign_facts()`, `match_vault()` (SQL) | pgTAP `07_mcp_tokens` (4 tests), `03_match_vault`; `mcp_check.py` plants 3 canary facts and checks every returned code against the DB |
| Rule cards are approved-only | `match_vault()` | pgTAP `03_match_vault` |
| No write tools; no draft text accepted or stored | `mcp.py` (two tools, nothing else) | `test_mcp.py::test_no_write_tool_or_method` |
| Tokens are stored as SHA-256 hashes, shown once, unreadable by app users, revocable for good | migration `20261031100022_mcp_tokens.sql` | pgTAP `07_mcp_tokens` |
| Brand admins only can create, list and revoke; create and revoke are audited | same | pgTAP `07_mcp_tokens` |
| 60 calls/min per token; 30 failed auths/min per client; 32 KB body cap | `mcp.py`, `config.py` | `test_mcp.py` |
| Logs carry token/org/campaign IDs, tool name, result count and time; never the query or the token | `mcp.py` | `test_mcp.py::test_logs_ids_and_counts_never_query_or_token` |

**What a token holder sees.** Approved rule card text and live fact values for that org (the same
snippets the review LLM receives). Treat a token like a password for that brand context. Revoke it
when a contractor leaves.

**Limits.** The rate limiter lives in the worker process (one instance on Render). The free-tier
worker sleeps when idle, so the first call after a while can take ~30–60 s.

## Create a token

**In the app (brand admin):** Settings → **AI tools (MCP)** → name it, pick the campaign →
**Create token**. The token and a ready-to-paste config are shown once. Revoke from the same list.

**In SQL (signed in as a brand admin):**

```sql
select public.create_mcp_token('<org_id>', '<campaign_id>', 'Cursor – Diwali');  -- returns ek_…, once
select public.revoke_mcp_token('<token_id>');
```

## Connect a client

Replace `<worker-url>` with the worker's public URL (the Render service URL) and `ek_…` with your
token.

**Cursor** (`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "errata": {
      "url": "https://<worker-url>/v1/mcp",
      "headers": { "Authorization": "Bearer ek_…" }
    }
  }
}
```

**Claude Code** (one command):

```bash
claude mcp add --transport http errata https://<worker-url>/v1/mcp --header "Authorization: Bearer ek_…"
```

or `.mcp.json` in the project:

```json
{
  "mcpServers": {
    "errata": {
      "type": "http",
      "url": "https://<worker-url>/v1/mcp",
      "headers": { "Authorization": "Bearer ek_…" }
    }
  }
}
```

**Quick check with curl:**

```bash
curl -s https://<worker-url>/v1/mcp \
  -H "Authorization: Bearer ek_…" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_campaign_facts"}}'
```

A good first prompt in the client: *"Use the errata tools to get the campaign facts and the rules
on returns claims, then draft a 40-word Instagram caption for the Diwali SIP webinar. Cite the
codes you used."*

## Acceptance check (20 calls)

`scripts/mcp_check.py` runs 20 scripted calls and prints a pass/fail table. With `--db-url` (local
database only; it refuses anything else) it plants three canary facts that must never come back
(never-send, expired, other campaign) using a real fact's embedding so they would rank first if a
filter broke, mints a token, checks every returned code against the database, then revokes the
token (call 20 must get 401) and deletes the canaries.

```bash
make db-start && make db-reset && make dev-local   # terminal 1 (worker on :8000)
make mcp-check                                     # terminal 2, or by hand:
cd apps/worker && eval "$(../../scripts/local-supabase-env.sh)" && \
  uv run python ../../scripts/mcp_check.py --url http://localhost:8000 --db-url "$DATABASE_URL" \
  --out eval/mcp_check.md                                  # terminal 2
```

Against a deployed worker with an existing token (no DB checks, no canaries):

```bash
cd apps/worker && uv run python ../../scripts/mcp_check.py --url https://<worker-url> --token ek_…
```

The latest recorded run is in [`apps/worker/eval/mcp_check.md`](../apps/worker/eval/mcp_check.md),
with a note on exactly what it ran against.
