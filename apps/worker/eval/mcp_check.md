# MCP check (2026-10-31 15:35 UTC)

Target: `http://localhost:8000`

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

**20/20 calls passed (0 skipped) in 0.2 s; 33 returned facts/rules checked against the DB; canaries planted: 3**
