# MCP check: sandbox run (2026-10-31)

> **What this ran against.** Not the full local Supabase stack: Docker images could not be pulled in the build sandbox. It ran against **Postgres 16 with every migration in `supabase/migrations` and `supabase/seed.sql` applied** (plus pgvector, pgmq, pgTAP and a minimal stand-in for Supabase's `auth`/`storage` schemas), with the worker's real MCP router and `PgMcpStore` served by uvicorn. The embedding model download was blocked, so vault rows and queries were embedded with a **deterministic word-hash stand-in**: search ranking below is not representative, but every scope, expiry, never-send, auth and validation check is the real SQL and the real handler. Re-run on the real stack with `make mcp-check` and replace this file.

Negative control: with the fact filter deliberately removed from `mcp_campaign_facts()`, the same script failed call 4 (all three canaries, expired E-11 and the other campaign's fact reported) and exited 1.

Target: `http://127.0.0.1:8765`

| # | Call | Expected | Got | Pass |
|---|---|---|---|---|
| 1 | initialize | 2025-06-18 + tools capability | 2025-06-18 ['tools'] | PASS |
| 2 | notifications/initialized | HTTP 202 | HTTP 202 | PASS |
| 3 | tools/list | exactly the 2 read-only tools | get_campaign_facts,search_brand_rules | PASS |
| 4 | get_campaign_facts | only live, in-scope, sendable items | 3 items [E-19,F-048,F-112] | PASS |
| 5 | search_brand_rules 'guaranteed returns on SIP' | only live, in-scope, sendable items | 10 items [VS-03,CL-03,F-048,A-01,VS-01,A-02,E-19,G-07,TV-02,TV-04] | PASS |
| 6 | search_brand_rules 'Diwali webinar date and venu' | only live, in-scope, sendable items | 10 items [VS-01,CL-03,TV-02,VS-02,E-19,A-01,G-07,TV-04,VS-03,A-02] | PASS |
| 7 | search_brand_rules 'exit load on redemption' | only live, in-scope, sendable items | 10 items [F-048,A-01,TV-02,VS-03,VS-02,CL-03,E-19,G-07,A-02,TV-04] | PASS |
| 8 | search_brand_rules 'historical CAGR claim with d' | only live, in-scope, sendable items | 10 items [F-112,TV-02,A-01,VS-01,CL-03,VS-03,A-02,F-048,TV-04,G-07] | PASS |
| 9 | search_brand_rules 'warm tone, no hype' | only live, in-scope, sendable items | 10 items [TV-02,VS-03,VS-02,TV-04,VS-01,CL-03,A-02,G-07,A-01,F-112] | PASS |
| 10 | search_brand_rules 'logo clear space and colours' | only live, in-scope, sendable items | 10 items [VS-03,TV-02,CL-03,A-02,VS-02,A-01,G-07,VS-01,TV-04,F-112] | PASS |
| 11 | search_brand_rules 'Navratri investor meet Hall ' | only live, in-scope, sendable items | 10 items [VS-01,A-02,G-07,TV-02,TV-04,VS-02,A-01,VS-03,CL-03,F-112] | PASS |
| 12 | search_brand_rules 'internal only canary never s' | only live, in-scope, sendable items | 10 items [G-07,CL-03,VS-03,A-02,VS-02,TV-02,A-01,TV-04,VS-01,F-112] | PASS |
| 13 | search_brand_rules 'mutual fund risk disclaimer' | only live, in-scope, sendable items | 10 items [CL-03,A-01,TV-02,A-02,G-07,TV-04,VS-01,VS-02,VS-03,F-112] | PASS |
| 14 | search_brand_rules 'festive playful copy about m' | only live, in-scope, sendable items | 10 items [TV-04,A-01,CL-03,TV-02,VS-01,VS-02,G-07,VS-03,A-02,F-112] | PASS |
| 15 | search with campaign_id=Navratri | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 16 | search limit=11 | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 17 | write tool create_fact | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 18 | get_campaign_facts with campaign_id=Navratri | HTTP 200, -32602 | HTTP 200, -32602 | PASS |
| 19 | unknown token | HTTP 401, -32001 | HTTP 401, -32001 | PASS |
| 20 | revoked token | HTTP 401, -32001 | HTTP 401, -32001 | PASS |

**20/20 calls passed in 0.3 s; 16 fact items checked against the DB; canaries planted: 3**
