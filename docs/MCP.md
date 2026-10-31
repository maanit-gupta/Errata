# Errata MCP server (read-only)

Lets an AI writing tool (Claude, Cursor, ChatGPT) start from **one campaign's approved brand context**
instead of guessing. Endpoint: `POST <worker-url>/v1/mcp` (JSON-RPC 2.0, MCP tools).

## Tools

| Tool | Returns |
|---|---|
| `get_campaign_facts` | Active facts for the token's campaign plus org-wide facts: code, statement, value, required disclaimer, expiry |
| `search_brand_rules(query, limit ≤ 10)` | Top approved rule cards and facts for the topic, each with the ID to cite and a similarity score |

## Guarantees (each has a test)

- A token is bound to **one org and one campaign**; the caller can't choose another (`tests/test_mcp.py`).
- Facts with `valid_until` in the past, and anything `never_send`, are never returned
  (`supabase/tests/03_match_vault.test.sql` for search; the same predicates are used by `get_campaign_facts`).
- Rule cards are approved-only. There are **no write tools**; drafts are never accepted.
- Tokens are stored as SHA-256 hashes, shown once, revocable, rate-limited to 60 calls/min
  (`supabase/tests/07_mcp_tokens.test.sql`).

## Create a token (brand admin)

```sql
select public.create_mcp_token('<org_id>', '<campaign_id>', 'Cursor – Diwali');  -- returns ek_…, once
```

Revoke: `update public.mcp_tokens set revoked_at = now() where id = '<id>';`

## Connect

```json
{ "mcpServers": { "errata": {
  "url": "https://<worker-url>/v1/mcp",
  "headers": { "Authorization": "Bearer ek_…" } } } }
```

Quick check:

```bash
curl -s https://<worker-url>/v1/mcp -H "Authorization: Bearer ek_…" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_campaign_facts"}}'
```
