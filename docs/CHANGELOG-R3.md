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
| `scripts/load_test.py`: default 20 submissions, `--n` for more, local only, in-process consumers running the worker's own code, `--simulate-rate-limit`, report writer, `make load-test` | Repeatable evidence without spending LLM quota | [`apps/worker/eval/load_report.md`](../apps/worker/eval/load_report.md): real stack (MacBook Air, 2026-11-01): 20/20 pending runs completed, non-LLM P95 8.46 s, 0 lost, 0 failed (sandbox earlier: P95 4.5 s) |

### Process

| Change | Why |
|---|---|
| Round 3 work happens on `round3/improvements`; merge only by PR on the owner's say-so | Vercel and Render deploy from `main` |
| `.claude/settings.json` turns off AI attribution trailers; commits are authored by the team member | Team rule for Round 3; AI assistance stays disclosed in the README (General Rules 6–7) |
| DB-gated worker tests run in CI against Supabase Postgres and restore the vault embeddings they swap | Evidence that runs on every PR, without breaking a local dev stack |

## Round 3 extras: Heroes 2–5

Stretch work (Round 2 extensions E2–E5), built 2026-11-01 from [`specs/V5_remaining_heroes_spec.md`](specs/V5_remaining_heroes_spec.md). The spec was treated as intent; every deviation is below.

| Hero | What it does | PASS IF | Result | Source |
|---|---|---|---|---|
| **3 Visual auto-heal** | For a failing WCAG 1.4.3 text line in an image, suggests the smallest **on-palette** colour change that passes (text, then background, then both). Shown as a preview; "Accept palette fix" only records the decision; nothing touches the image | Every fix from the palette and ≥ 4.5:1 (3:1 large) on 20 labelled samples; none applied without Accept | **PASS**: 18/18 fixable samples fixed from the palette and passing; the 2 pastel-only samples correctly get no suggestion | Sandbox |
| **4 Cross-modal check** | Compares dates, times and percentages across the image text (OCR), the caption and the landing-page text; cites the vault fact that applies; anchors on the image text and names the other span | ≥ 9/10 conflicting posts flagged citing both spans; 0 flags on 10 consistent posts | **PASS**: 10/10 flagged, 0/10 false flags; a real OCR'd banner flagged too | Sandbox |
| **2 Publish receipt + kill-switch** | At publish-ready, a receipt (SHA-256 of the normalised text, the facts it relies on, the earliest expiry). Editing or deleting a relied-on fact sends approved/publish-ready content back to revision at once; an expiry is caught by a sweep the worker runs every minute. All moves go through the workflow function, audited with a reason | Edit → back to revision at once; expiry within one sweep; unrelated items untouched | **PASS**: pgTAP 22/22 plus DB tests (incl. the worker's own sweep loop) | Plain Postgres |
| **5 GCS shadow backtest** | Before approving new examples for an unclear rule, re-scores the rule's last 30 findings with the local embedding model and shows a labelled **projection** (false positives removed and true positives lost); fewer than 10 findings → "insufficient data" | 30-draft backtest < 60 s; identical output twice | **PASS**: identical output twice; 0.15 s for two runs (stand-in embedder) | Plain Postgres + stand-in embedder |

| Spec said | Built | Why |
|---|---|---|
| A trigger runs `UPDATE contents SET state = 'needs_revision'` | A new system-only branch in `private.apply_transition` (reason required, audited); the trigger and the sweep call it | Invariant 7: every state change goes through the workflow function |
| Trigger on fact UPDATE only | Also a BEFORE DELETE trigger, and `sweep_expired_fact_dependencies()` called by the worker every minute | A date passing never fires an UPDATE trigger |
| Store the hash and manifest on `versions` | A `publish_manifests` table, revoked when the content leaves publish-ready | Versions are immutable (a trigger rejects every update) |
| Dependencies "during Stage 3" | `filters/facts.dependent_fact_ids` plus the facts the findings cite, rewritten on every run | Same code path as the facts filter |
| Palette from the request, plus #111/#FFF fallbacks | Only the org's palette asset; no fallbacks; no suggestion if no palette colour passes | "Every fix comes from the palette" |
| Hardcoded `E-19` citation for cross-modal drift | The in-scope, unexpired vault fact that applies; no applicable fact → no finding | Invariant 1 (no uncited findings), no hardcoding |
| `versions.ocr_banner_text`, `target_url_text` columns | The OCR text from the existing image stage, plus optional `caption`/`landing_page_text` in the intent | Versions are immutable; the OCR output already exists in the pipeline |
| Shadow sandbox fallback numbers (60→91, 0.42→0.08), `× 0.4` override factor, decisions joined on `version_id` | The dashboard's own `rule_gcs()` for "now"; only the dismissal rate is projected; override and low-confidence rates are held; "insufficient data" under 10 findings | The spec's numbers were fabricated and its join mixed decisions across findings |
| Unauthenticated `/v1/heroes/*` endpoints | `simulate-rule` needs the user's Supabase session (verified with Supabase Auth) and a brand admin or manager role in the rule's org. Hero 3/4/2 need no endpoint (they run in the pipeline and SQL) | No unauthenticated reads of org data |
| Inline Tailwind greys, vermilion styling | DESIGN.md tokens; colours from data validated as `#RRGGBB` before becoming inline styles | One design system; no CSS injection |

New migrations: `20261101100025_visual_autoheal.sql`, `20261101100026_fact_kill_switch.sql`.

## Round 3 audit follow-ups (2026-11-03)

An audit of every item in the team's master engineering checklist (80 items: schema, pipeline, Heroes 1–5, UI, tests), run on the real stack. Result before these fixes: 68 pass, 7 partial, 5 missing. Of the passes, 21 are built differently from the checklist's wording on purpose (the deviations above and in [`CLAUDE.md`](../CLAUDE.md)). The 5 missing items are deliberate too: the two MCP write tools (read-only decision) and three standalone `/v1/heroes/*` endpoints whose logic runs inside the pipeline and SQL. Those were kept as they are. These changes close the gaps:

| Change | Why | Evidence |
|---|---|---|
| `/review` queue refreshes live (Realtime on `contents`, `findings`) | New submissions and kill-switch revocations needed a reload there; the detail pages were already live | `next build`, tsc |
| Worker warms bge-small in `lifespan` before serving | The first review or MCP pre-check after boot paid the cold model load | Measured on the MacBook: cold ~415 ms, warm median 4.8 ms (p95 6.1 ms); `test_main.py` |
| Demo campaign `ends_on` and E-19 `valid_until`: 2026-11-15 → 2027-03-31 (`seed.sql`, `demo_data.py`, `facts.csv`) | Demos after Nov 15 would see the webinar fact as expired. Fixed dates keep tests and eval deterministic | pgTAP and DB-gated tests pass on the new seed |
| Publish receipt: live "expires in …" countdown, warning style within 7 days | The receipt showed only a date | `lib/review/__tests__/countdown.test.ts` |
| Services & AI use: open-source licence section (PyMuPDF → AGPL-3.0, licence and source links), in-app and public | The licence was only in the marketing footer | Rendered on `/ai-use` |
| Visual auto-heal: CSS shown, plus "Copy CSS fix" | Designers can paste the fix; built only from validated `#RRGGBB` values, so no schema change | `visual-fix.test.ts` |
| Vault: delete a fact. Approved dependants go back to revision via the existing BEFORE DELETE kill-switch; a fact that findings cite is **retired** (expires now) instead, because `findings.fact_id` keeps the citation | Invariant 1 and audit history; both paths are audited | pgTAP `11_fact_delete` (10 tests) |

**Real-stack results (local Supabase on the MacBook, 2026-11-03).** At the audit, before these changes:

- Worker: 311 passed, 17 DB-gated skipped; the 4 DB-gated files pass 19/19.
- Vitest 191, pgTAP 172 in 11 files.
- `make mcp-check` 20/20, with 0 of 3 planted canaries leaked.

After these changes:

- Worker: 313 passed, 17 skipped; **330 passed, 0 skipped** with `TEST_DATABASE_URL`.
- Vitest 196, pgTAP 182 in 12 files.
- ruff, mypy, ESLint, Prettier and tsc clean; `next build` 19 routes.

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
