# Errata: final report (Round 3)

Team 9thHACK (SRMIST): Jagpreet Singh (team leader) and Maanit Gupta. Inkloom AI brand-governance
problem statement, We Code Coders hackathon. Live app: https://brandlens-app.vercel.app (demo
roles, fictional PayWise data). Repo: https://github.com/maanit-gupta/Errata.

**Where each result comes from.** **Real stack** = local Supabase (Postgres, Auth, Storage,
Realtime, pgmq) on the team's MacBook. **Plain Postgres** = Postgres 16 with every migration and
the seed applied, in the build sandbox (no Supabase services). **Sandbox** = the build sandbox with
a stand-in noted. **Live** = the deployed app. **Eval** = the golden-set run with committed LLM
responses.

## 1. The problem

Marketing teams in regulated categories (here, a mutual-fund app) ship copy that breaks their own
brand guide and facts: a guaranteed-returns claim, last campaign's date and venue, the wrong fee,
the brand name spelled wrong. Manual checks are slow and inconsistent, and generic AI checkers
can't say *which* rule a flag comes from, so reviewers can't trust or audit them.

## 2. What we built

Errata checks every draft (text, DOCX, image, PDF deck) against the organisation's approved rule
cards, facts and assets before it ships. **Every flag cites the rule, fact or WCAG ID it was checked
against**, and people decide: the creator fixes or routes, a reviewer or specialist signs off with a
reason, and Errata never publishes.

- **Pipeline:** ingest → redact PII and secrets → deterministic checks (glossary, Fact Vault
  dates/venues/fees, campaign bleed, claims lexicon, tone, readability, WCAG contrast, ΔE, logo) →
  pgvector retrieval → **one** LLM call → citation gate (a finding survives only if its cited IDs
  were retrieved and its quote is in the text).
- **Workflow:** a state machine in SQL (`transition_content()`), routing by risk to manager or
  specialist queues, version diffs, comments, an append-only audit trail, Discord notifications.
- **Guideline Clarity Score:** per-rule scores from dismissals, overrides and low-confidence
  findings; unclear rules get suggested examples that a brand admin approves into a new version.
- **Stack:** Next.js 16 on Vercel, a FastAPI worker on Render, Supabase (RLS on every table,
  pgvector, pgmq, Realtime), Groq with Gemini fallback (free tiers), bge-small embeddings.

### Round 3: the three improvements we committed to

| # | Improvement | Done when | Status |
|---|---|---|---|
| 1 | **Read-only MCP server**: `get_campaign_context`, `precheck_draft_fast`, `verify_claim_evidence`, resource `brandvault://campaigns/active`, prompt `brandlens-governed-draft`; personal `bl_mcp_` keys; Settings → AI tools (MCP) | 20 test calls return only live facts for the requested campaign and no never-send text | **Built.** 20/20 on plain Postgres with three planted canaries; a negative control (filter removed) fails as it should. Real-stack run (`make mcp-check`) pending |
| 2 | **Real users**: A/B benchmark (manual vs Errata) and SUS; Clarity Score on real data | SUS ≥ 70, and participants catch more seeded issues with Errata than by hand | **Kit built; sessions not run yet.** The real-data filter (`contents.simulated`, "Real reviews only") is built and tested (pgTAP, real stack). No usability numbers exist yet |
| 3 | **Hold up under load**: "AI check pending" instead of silent degraded results, plus a repeatable load test | Non-LLM P95 < 15 s, zero lost jobs, every pending run completes | **Built.** Sandbox load test: 20/20 pending runs completed, non-LLM P95 4.5 s, 0 lost, 0 failed. Real-stack run (`make load-test`) pending |

Details: [`docs/MCP.md`](MCP.md), [`docs/usability/`](usability/), [`apps/worker/eval/load_report.md`](../apps/worker/eval/load_report.md), [`docs/CHANGELOG-R3.md`](CHANGELOG-R3.md).

## 3. Results

| Result | Value | Source |
|---|---|---|
| Golden set (60 drafts: 49 text, 10 images, 1 PDF; 13 clean) | Blocker recall **1.00**; **0** uncited findings shown; precision per dimension 0.90–1.00 (gate 0.85); 0 of 13 clean drafts flagged | Eval, 2026-10-27 ([`report.md`](../apps/worker/eval/report.md)) |
| Rewrite intent check (`INTENT_COSINE` 0.74) | Keeps 15/16 good rewrites, rejects 24/24 bad ones | Eval |
| Text review latency, 30 drafts | P50 3.0 s, P95 15.2 s (LLM time as recorded; target ≤ 15 s, just missed) | Eval |
| Images / PDFs | Logo found in 9/9 creatives, 0 false positives; contrast within ±0.1 of WebAIM on 40/40 pairs; 9/9 seeded deck issues on the right page; 40-page deck under 512 MB | Eval |
| Database tests (pgTAP) | **147 tests in 9 files, all pass** (RLS, workflow, retrieval, Clarity Score, rate limit, MCP keys, real-data split) | Real stack, 2026-10-31 |
| `make check` | Green: ruff, mypy, ESLint, Prettier, tsc; worker 239 passed / 7 skipped (the 7 need a database URL); web 188 passed | Real stack, 2026-10-31 (at `d19c525`) |
| DB-gated worker tests (pending flow + MCP golden set) | 9 passed, including negative controls that fail when the logic is removed | Plain Postgres; CI runs them on Supabase Postgres |
| MCP acceptance | 20/20 calls; 33 returned facts/rules checked against the database; 3 canaries never returned | Plain Postgres, stand-in embedder |
| Load (20 submissions, simulated 45 s rate limit) | 20 went pending, 20 completed, 0 degraded; non-LLM P50 4.3 s, P95 4.5 s; 0 lost; 0 failed | Sandbox (plain Postgres, stand-in embedder) |
| Accessibility | 0 serious/critical axe violations on every route × 2 themes (2026-10-28, local stack); production UI gates 49 passed, 1 skipped (2026-10-27, live); Round 3 components 0 violations (sandbox) | As stated |
| Usability (A/B, SUS) | **Pending real sessions** | — |

The sandbox numbers show the code paths work. The real-stack runs that still need doing are listed
in §4.

## 4. Testing and reliability evidence

- **Invariants under test:** no uncited finding is shown (gate tests, eval); the LLM is untrusted
  (schema-bound output, local quote matching, prompt-injection tests); RLS on every org table
  (pgTAP); all workflow changes through `transition_content()` (pgTAP); precision gate in CI.
- **Degraded and pending modes:** transient LLM failures now go "AI check pending" with the
  deterministic findings saved at once and a retry queued in the same transaction; permanent
  failures degrade at once (`test_llm_router.py`, `test_llm_pending.py`).
- **Restarts:** pgmq visibility timeouts and idempotent runs (`scripts/redelivery_test.py`, P15).
- **CI:** lint, types, unit tests, pgTAP, schema lint, the DB-gated worker tests, the worker
  image build, and the golden-set precision gate on prompt changes.

Still to run on the real stack before the merge (commands in `PROGRESS.md` → Handoff):
`make mcp-check`, `make load-test`, the 7 DB-gated worker tests, and the signed-in axe pass on the
Round 3 pages.

## 5. Limitations and roadmap

- **Free-tier LLM quotas** are the throughput limit. Pending mode makes this visible and
  self-healing, but sustained bursts need a paid tier or a per-organisation LLM budget.
- **MCP:** the claim-similarity threshold (`MCP_CLAIM_FACT_MIN_SIM = 0.78`) is **uncalibrated**
  (deterministic findings decide a blocker first); the rate limiter is per worker process; Claude
  Desktop needs the `mcp-remote` bridge.
- **Usability evidence** is pending: the kit is ready, and no numbers will be reported until real
  sessions are run.
- **Privacy:** self-service export and erasure, retention rules and a breach runbook are roadmap;
  deleting a user who appears in the audit trail is currently blocked by the append-only trigger
  ([`PRIVACY-SECURITY-A11Y.md`](PRIVACY-SECURITY-A11Y.md)).
- **Checks:** vector-drawn logos in PDFs aren't detected; scanned PDFs are rejected; JPEG contrast
  is an estimate.
- **Roadmap:** Google sign-in, Slack, a CMS hand-off (still human-approved), multilingual rule
  cards, per-channel rule scoping, an MCP submit tool once the read-only server has proven itself.

## 6. Contributions

| Member | Role | Contribution |
|---|---|---|
| **Jagpreet Singh** (team leader) | Product, frontend and UX | Product direction and the Round 1 plan and storyboard; the UI redesign (design study, the flat outlined design system, tokens and contrast test, shell, landing, sign-in, illustrations); the rename to Errata; the demo video; usability testing design and sessions; the live demo; Round 3 delivery on `round3/improvements` (MCP server and settings, usability kit, Clarity Score real-data filter, "AI check pending", load test, these documents) |
| **Maanit Gupta** | AI and backend | Worker pipeline (ingest, redaction, deterministic filters, retrieval, LLM pass, citation gate, intent check), vision and PDF checks, schema, RLS and workflow SQL, the golden set and CI precision gate, deployment, security hardening |

Both members used Claude Code (Anthropic) as a pair programmer; this is disclosed in the README
(General Rules 6–7), and every change was reviewed and committed by a team member.
