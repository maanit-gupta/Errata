# MCP check: sandbox run (2026-10-31)

> **What this ran against.** Not the full local Supabase stack: Docker images could not be pulled in the build sandbox. It ran against **Postgres 16 with every migration in `supabase/migrations` and `supabase/seed.sql` applied** (plus pgvector, pgmq, pgTAP and a minimal stand-in for Supabase's `auth`/`storage` schemas), with the worker's real MCP router, `PgMcpStore` and deterministic pipeline served by uvicorn. The embedding model download was blocked, so vault rows and queries were embedded with a **deterministic word-hash stand-in**: rule ranking and claim similarity below are not representative, but every scope, expiry, never-send, agency, auth and validation check is the real SQL and the real handler. Re-run on the real stack with `make mcp-check` and replace this file.

Negative control: with the never-send/expiry/campaign filter deliberately removed from `mcp_campaign_facts()`, the same script failed calls 5, 6 and 14 (all three canaries reported) and exited 1.

Target: `http://127.0.0.1:8765`

| # | Call | Expected | Got | Result |
|---|---|---|---|---|
| 1 | initialize | 2025-06-18; tools, resources, prompts | 2025-06-18 ['prompts', 'resources', 'tools'] | PASS |
| 2 | notifications/initialized | HTTP 202 | HTTP 202 | PASS |
| 3 | tools/list | exactly the 3 read-only tools | get_campaign_context,precheck_draft_fast,verify_claim_evidence | PASS |
| 4 | prompts/get brandlens-governed-draft | the check-fix loop, no submit tool | HTTP 200 | PASS |
| 5 | get_campaign_context 'Diwali SIP' | live Diwali + org-wide facts, approved rules | 3 facts, 8 rules | PASS |
| 6 | get_campaign_context as agency creator | rule summaries only | 3 facts, 8 rules | PASS |
| 7 | get_campaign_context 'Navratri' (ended) | tool error, no facts | No active campaign matches 'Navratri'. Active campaigns: Diwali SIP 2026. | PASS |
| 8 | precheck the flawed hero caption | BLOCKED: CL-03, E-19, F-048, G-07 | BLOCKED | PASS |
| 9 | precheck the remediated draft | PASS_DETERMINISTIC | PASS_DETERMINISTIC | PASS |
| 10 | precheck without the CTA | BLOCKED: cta_missing | BLOCKED | PASS |
| 11 | precheck on another org's campaign | tool error (not found) | Campaign not found in your organisation. | PASS |
| 12 | verify_claim '14.2% assured annual returns' | BLOCKER | BLOCKER | PASS |
| 13 | verify_claim aimed at the canaries | no canary or out-of-scope fact | UNSUBSTANTIATED_NO_MATCHING_FACT | PASS |
| 14 | resources/read campaigns/active | live, sendable facts only | 1 campaigns | PASS |
| 15 | get_campaign_context with an org_id argument | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 16 | precheck with a 15,001-char draft | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 17 | write tool submit_to_brandlens_queue | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 18 | unknown key | HTTP 401, -32001 | HTTP 401, -32001 | PASS |
| 19 | expired key | HTTP 401, -32001 | HTTP 401, -32001 | PASS |
| 20 | revoked key | HTTP 401, -32001 | HTTP 401, -32001 | PASS |

**20/20 calls passed (0 skipped) in 0.4 s; 33 returned facts/rules checked against the DB; canaries planted: 3**
