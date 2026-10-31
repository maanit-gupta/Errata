# Change log: from the Round 1 plan to Round 3

Every change since the Round 1 plan (`docs/plan.pdf`), newest first, with the reason. The full
decision trail, with dates, is in [`PROGRESS.md`](../PROGRESS.md) → Decisions log.

Where a result is quoted, its source is labelled: **real stack** (local Supabase on the team's
MacBook), **plain Postgres** (Postgres 16 with every migration applied, in the build sandbox) or
**sandbox** (the build sandbox, with stand-ins noted).

## Round 3 (2026-10-31, branch `round3/improvements`)

### Improvement 1: read-only MCP server

| Change | Why | Evidence |
|---|---|---|
| `POST /v1/mcp` on the worker (MCP Streamable HTTP, JSON responses) with three tools: `get_campaign_context`, `precheck_draft_fast`, `verify_claim_evidence`; resource `brandvault://campaigns/active`; prompt `brandlens-governed-draft` | Shift left: AI writing tools start from live campaign facts and approved rules, and pre-check copy before it reaches the review queue | [`docs/MCP.md`](MCP.md) |
| Built from the team's MCP build spec, **read-only subset**: no `submit_to_brandlens_queue` or `log_rule_feedback` | Round 3 promised a read-only server; submitting stays in Errata, where intent capture, the AI pass and human approval live | Owner decision, PROGRESS.md 2026-10-31 |
| Pre-check and claim checks run the pipeline's own Stage 1 and Stage 3 code; retrieval uses `match_vault`; no external LLM call | No duplicate logic; deterministic first (invariant 3); milliseconds, no quota | `test_mcp_server.py`: the hero caption is BLOCKED with CL-03, E-19, F-048 and G-07 in < 50 ms (plain Postgres) |
| Personal `bl_mcp_` keys: SHA-256 hash only, shown once, 1–365 day expiry, at most 5 live per user, revocable by the owner or a brand admin, role read from `memberships` on every call, create and revoke audited | The spec's policy let a member mint a `brand_admin` key or revive a revoked one; a demoted or removed user's key now follows the membership | pgTAP `07_mcp_api_keys` (29 tests, real stack) |
| Never returns never-send items, expired facts or another campaign's facts; findings that cite a never-send item are withheld and counted | Invariant 5: never send never-send items to an external LLM; the spec's claim tool and resource had no never-send filter | `mcp_check.py` 20/20 with three planted canaries (plain Postgres; a negative control with the filter removed fails) |
| Agency keys get the app's agency view of rules (code, dimension, title, summary, severity) | Same boundary as `rule_cards_public`; the spec's 160-character truncation still leaked rule text | `test_mcp.py`, `test_mcp_server.py` |
| Settings → **AI tools (MCP)** for every member: "Connect Claude or Cursor" dialog with configs for Cursor, Claude Code and Claude Desktop; key list with revoke | Usable without SQL | axe: 0 violations on the kitchen-sink preview in both themes (sandbox) |
| Intent check uses the calibrated `INTENT_COSINE` 0.74 and only against a real baseline; CTA check always | The spec's 0.82 dropped 6 of 16 good rewrites in P14 calibration | `test_mcp.py` |
| An earlier campaign-scoped token draft (`wip/r3-mcp-draft`) was reviewed and replaced before it was applied anywhere | Its revoke grant allowed un-revoking, the embed call blocked the event loop, and the fact filter lived only in Python | PROGRESS.md 2026-10-31 |

### Improvement 2: real users and the Clarity Score on real data

| Change | Why | Evidence |
|---|---|---|
| `contents.simulated` flag (backfilled from the simulator's "[Simulated] " titles; app users can't set it). `rule_gcs()` and `insights_summary()` take `p_include_simulated` | The Clarity Score must be computable on real reviews alone | pgTAP `08_insights_real_data` (12 tests, real stack) |
| The "Illustrative data" pill now shows only when simulated review runs are in the window and counted | It used to key off append-only audit events, so it never turned off | pgTAP `05_insights` (updated) and `08` |
| Insights: **All data / Real reviews only** filter, shown only when simulated rows are in the window | Lets judges and admins see real-only scores | e2e `insights.spec.ts` (needs the local stack) |
| Usability kit: one-page moderator checklist, printable consent, `sessions.csv`, `scripts/usability_summary.py`, tasks T1–T6 re-checked against the current UI, an "AI check pending" comprehension probe | Ready for 8–15 real sessions; numbers come only from the script | `test_usability_summary.py` (FAKE-labelled fixture only). **No sessions run yet** |
| Caption 2 of the A/B test is pinned by a unit test to the same four deterministic issues as caption 1 | The benchmark mustn't depend on LLM quota | `test_pipeline.py` |

### Improvement 3: hold up under load, "AI check pending"

| Change | Why | Evidence |
|---|---|---|
| When every LLM provider is rate-limited or failing transiently, the run saves its deterministic findings at once, stays `llm_pending`, keeps the content in ai_check and queues a delayed retry (60/120/240/480 s) **in the same transaction**; after the last retry it finishes degraded as before. Permanent failures (bad model, invalid output) degrade at once | Replace silent degraded results; never route on partial results; a pending run can't lose its retry; still one LLM pass per draft through the same citation gate | `test_llm_pending.py`: 4 DB tests of the real job and pgmq, plus a negative control (plain Postgres; CI runs them on Supabase Postgres) |
| Draft page: "AI check pending" banner, rule-based findings shown read-only, run-log line; fills in via Realtime | The creator sees what's done and doesn't resubmit | Kitchen-sink axe, both themes (sandbox) |
| `scripts/load_test.py`: default 20 submissions, `--n` for more, local only, in-process consumers running the worker's own code, `--simulate-rate-limit`, report writer, `make load-test` | Repeatable evidence without spending LLM quota | [`apps/worker/eval/load_report.md`](../apps/worker/eval/load_report.md): sandbox run 20/20 pending runs completed, non-LLM P95 4.5 s, 0 lost, 0 failed. **Real-stack run pending** |

### Process

| Change | Why |
|---|---|
| Round 3 work happens on `round3/improvements`; merge only by PR on the owner's say-so | Vercel and Render deploy from `main` |
| `.claude/settings.json` turns off AI attribution trailers; commits are authored by the team member | Team rule for Round 3; AI assistance stays disclosed in the README (General Rules 6–7) |
| DB-gated worker tests run in CI against Supabase Postgres and restore the vault embeddings they swap | Evidence that runs on every PR, without breaking a local dev stack |

## Round 2 build (2026-10-20 to 2026-10-29): deviations from the Round 1 plan

| Area | Round 1 plan said | We built | Why |
|---|---|---|---|
| Auth | Google sign-in | Supabase email/password, plus a demo role switcher | No OAuth setup; judges get one-click roles |
| LLM | Claude or Gemini | Groq primary, Gemini fallback, both free tiers | Free APIs; the provider switch avoids lock-in |
| Confidence | Two-sample agreement on every LLM finding | Second sample only for blocker-severity LLM findings | Resolves the plan's "one LLM call per draft" vs "two samples" |
| Embeddings | bge-small via sentence-transformers | Same model via fastembed (ONNX) | No torch; smaller worker image |
| Notifications | Slack and email | Discord webhook; email optional and off | Team uses Discord |
| Tracing | Self-hosted Langfuse | Langfuse Cloud (metadata only) | Faster to set up |
| Web framework | Next.js 15 | Next.js 16 | Current stable |
| Hosting | Worker on Railway or Fly; Supabase in Mumbai | Worker on Render (Docker); Supabase in Singapore | Free tiers available at build time |
| Visual design | Light off-white palette, serif headings | Flat, outlined, light-first system with a dark theme ([`DESIGN.md`](DESIGN.md)) | Team design decision (2026-10-28) |
| Name | BrandLens | Errata (user-facing; internal identifiers keep `brandlens`) | Team decision; renaming internals would break deploys and data |
| Data training | "No training on our data" | True for Groq and paid tiers; the Gemini free tier may use prompts, so demo data is fictional and the AI-use page says so | Honesty |

What the Round 2 build added, by phase (details in [`PROGRESS.md`](../PROGRESS.md) and the README's AI-assistance table): schema, RLS and the workflow state machine (P01); web shell and demo roles (P02); worker core, LLM router and embeddings (P03); vault ingestion and the PayWise kit (P04–P05); the six-stage pipeline with the citation gate (P06–P07); editor, findings and review workflow (P08–P09); deploy and core-loop e2e (P10); image and PDF checks (P11–P12); Guideline Clarity Score and insights (P13); golden set and precision gate (P14); hardening (P15); docs and demo (P16); then the UI redesign and the rename.
