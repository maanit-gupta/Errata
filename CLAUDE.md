# BrandLens — CLAUDE.md

BrandLens is a **pre-publication brand-governance tool**. Every draft (text, doc, image, PDF) is checked against an organisation's approved **rule cards, facts and assets**, and every flag **cites the rule or fact ID it was checked against**. Humans approve; BrandLens never publishes.

This is a hackathon build (Inkloom AI brand-governance problem statement, Round 2 "Build"), by a two-person team:

- **Maanit Gupta**: AI and backend lead. Owns the worker, schema/RLS, vision and eval.
- **Jagpreet Singh**: product, frontend and UX lead. Owns the Next.js client, workflow UI, usability testing and the demo.

Round 2 is judged on five things: end-to-end workflow (30), depth and reliability (25), progress vs plan (20), three committed improvements (15) and usability (10). Working, demoable, honest software beats breadth.

## Source of truth

| File | Role |
|---|---|
| `docs/plan.pdf` | Round 1 plan, used for product intent and judging context. **Do not read it by default** (it's large); consult a specific page only when SPEC is silent. |
| `docs/SPEC.md` | The **build spec**. It wins over the PDF on any conflict, because it records the deliberate deviations. |
| `docs/PHASES.md` | Phase-by-phase tasks and acceptance criteria. |
| `docs/DESIGN.md` | Visual and interaction system (flat, outlined, light-first; adopted 2026-10-28 on `UI/UX_jagpreet`) and the redesign status (§14). Wins on look and feel. |
| `PROGRESS.md` | Live state: phase status, the latest handoff, decisions and open questions. **Read it first, every session.** |

---

## Session protocol (read this before doing anything)

The team works in **phase-scoped sessions**: `/clear` → `/next` (or `/next P07`). Context does not survive `/clear`; `PROGRESS.md` is the memory.

1. **Start.** Read `PROGRESS.md`, then **only** your phase's section in `docs/PHASES.md`, then the `docs/SPEC.md` sections that phase lists under "Read first". Do not crawl the whole repo; open files as you need them.
2. **One phase per session.** Don't start the next phase, even if there's room.
3. **Plan briefly.** Write a short task list, then build. Check off acceptance criteria as you go.
4. **Verify.** Run `make check` (lint, types, tests) plus the phase's own acceptance checks. A phase is not done while anything is red.
5. **Record.** Update `PROGRESS.md`:
   - set the phase status
   - rewrite the **Handoff** section (what exists now, what's stubbed, gotchas, exact next step)
   - append to **Decisions**
6. **Commit.** Use a conventional commit **on `main`** (no phase or UI branches, no worktrees; user rule 2026-10-27), e.g. `feat(worker): P07 citation gate`. Then stop and tell the user: *"P07 done. Run /clear then /next."*
7. **If context is getting heavy mid-phase**, run the `/checkpoint` routine: write a precise handoff (status `partial`, the exact next step), commit WIP, and stop.
8. **Decisions.** If a decision is genuinely the user's (money, accounts, scope cuts, anything listed under "Open questions"), ask. Otherwise pick the SPEC default, log it under Decisions, and keep going.

**Parallel work.** Maanit and Jagpreet may run phases at the same time, both on `main` (pull before you start, commit small, push often). Before starting, set `Owner/Session` on your phase row in `PROGRESS.md` and commit that line immediately. Never start a phase whose dependencies aren't `done`. Never edit another in-progress phase's files without saying so in the handoff.

---

## Deliberate deviations from the Round 1 PDF

Keep the README's "Changes since Round 1" section in sync with this table.

| Area | PDF said | We build | Why |
|---|---|---|---|
| Auth | Google sign-in | Supabase **email/password**, plus a **demo role switcher** when `NEXT_PUBLIC_DEMO_MODE=true` | No OAuth setup; judges get one-click roles |
| LLM | Claude or Gemini | **Groq** primary, **Gemini** fallback, both free tiers, chosen by `LLM_PROVIDER` | Free APIs; the provider switch still avoids lock-in |
| Notifications | Slack + email | **Discord webhook** + optional email (Resend) | Team uses Discord |
| Tracing | Self-hosted Langfuse | **Langfuse Cloud** | Faster to set up. Traces contain only fictional PayWise demo data. |
| Web framework | Next.js 15 | **Next.js 16** (App Router) | Current stable |
| Confidence | Two-sample agreement on every LLM finding | Second sample **only for blocker-severity LLM findings** | Resolves the "one LLM call per draft" vs "two samples" contradiction in the PDF |
| Embeddings | bge-small via sentence-transformers | Same model via **fastembed** (ONNX) | Avoids torch and keeps the worker image small |
| Visual design | Light off-white palette, serif headings | **Terminal Noir** (`docs/DESIGN.md`): dark default plus light theme, Geist Sans/Mono | Team design decision; IDs first-class, colour never the only cue |
| Data training | "No training on our data" | True for Groq and paid tiers. The **Gemini free tier may use prompts**, so the demo uses fictional data only, and the Services and AI-use page says so. | Honesty |

---

## Tech stack

**Monorepo**
- pnpm workspaces (JS) and uv (Python)
- Node 22+ LTS, Python 3.12
- Licence: **AGPL-3.0**, because PyMuPDF is AGPL

**Web (`apps/web`)**
- Next.js 16, App Router, TypeScript strict
- Tailwind CSS v4, shadcn/ui, lucide-react
- TipTap (editor and highlight marks)
- Recharts, zod
- `@supabase/ssr` and `@supabase/supabase-js`
- `diff` for version diffs, sonner for toasts
- Vitest and Playwright for tests

**Worker (`apps/worker`)**
- FastAPI, uvicorn, Pydantic v2, pydantic-settings
- psycopg 3 (pgmq and Postgres access), supabase-py (Storage only)
- Parsing: PyMuPDF, python-docx, trafilatura (URL import)
- Text checks: pyahocorasick (glossary), textstat (readability)
- Vision: OpenCV (ORB and matchTemplate), PaddleOCR (lazy import) with pytesseract fallback, scikit-image (CIEDE2000)
- fastembed with `BAAI/bge-small-en-v1.5` (384-d)
- LLM SDKs: `groq` and `google-genai`, behind one provider interface
- langfuse (Cloud), tenacity (retries)
- pytest, ruff, mypy

**Data**
- Supabase: Postgres 16+, RLS on every org table, `vector` (HNSW, cosine), `pgmq`
- Storage (private buckets with signed URLs), Auth (email/password), Realtime

**Delivery**
- Web on Vercel
- Worker as a Docker container on Railway or Fly (2 GB RAM)
- Cloud Supabase (Mumbai region)
- GitHub Actions: lint, types, tests, migrations check and the golden-set precision gate

Don't add a dependency without logging it under Decisions in `PROGRESS.md`, along with its licence. The README licence table is generated from these entries.

---

## Repo layout

```
brandlens/
├── CLAUDE.md  PROGRESS.md  Makefile  LICENSE  README.md
├── .claude/commands/          next.md, checkpoint.md
├── docs/                      SPEC.md, PHASES.md, plan.pdf
├── fixtures/paywise/          demo brand kit: guide (md→pdf), facts.csv, glossary.csv, logos/, creatives/
├── apps/
│   ├── web/                   Next.js
│   │   ├── app/(auth)/login   app/(app)/{drafts,review,vault,insights,settings}/
│   │   ├── components/        ui/ (shadcn) + feature components
│   │   ├── lib/supabase/      browser.ts, server.ts, admin.ts (server-only), proxy helper
│   │   ├── lib/workflow/      transitions, routing display, permissions
│   │   ├── lib/notify/        discord.ts, email.ts
│   │   ├── lib/env.ts         zod-validated env
│   │   └── types/database.ts  GENERATED. Never hand-edit.
│   └── worker/
│       ├── brandlens_worker/
│       │   ├── main.py  config.py  settings.py  db.py  queue.py  tracing.py  embeddings.py
│       │   ├── jobs/          ingest_guide.py, embed_vault.py, review_version.py, generate_examples.py
│       │   ├── pipeline/      ingest.py protect.py filters/ retrieve.py llm_pass.py gate.py intent.py confidence.py
│       │   ├── vision/        logo.py, ocr.py, colour.py, contrast.py
│       │   ├── llm/           base.py, groq_provider.py, gemini_provider.py, router.py, cache.py
│       │   └── prompts/       *.md with a PROMPT_VERSION header
│       ├── eval/              golden/, run_eval.py, report.py
│       ├── tests/
│       └── Dockerfile
├── supabase/                  config.toml, migrations/, seed.sql, tests/ (pgTAP)
├── scripts/                   seed_demo.py, build_fixture_pdf.py, reset_demo.sh
└── .github/workflows/ci.yml
```

---

## Commands

`make` is the entry point. P00 creates these targets; keep them working.

| Target | What it does |
|---|---|
| `make setup` | Install everything (`pnpm i`, `uv sync`) |
| `make db-start` / `make db-stop` | Local Supabase via the CLI (Docker required) |
| `make db-reset` | Re-apply all migrations and `seed.sql` locally |
| `make db-new name=x` | New migration file. **Never edit an applied migration.** |
| `make types` | Regenerate `apps/web/types/database.ts` from the local DB |
| `make dev` | Web on :3000 and worker on :8000, concurrently |
| `make dev-web` / `make dev-worker` | One side only |
| `make test` | pytest + Vitest + pgTAP (`supabase test db`) |
| `make e2e` | Playwright core-loop test (needs `make dev`) |
| `make lint` / `make fmt` | ruff, mypy, ESLint, Prettier, `tsc --noEmit` |
| `make check` | lint + types + test. **Must be green to finish a phase.** |
| `make eval` | Golden-set eval. Writes `apps/worker/eval/report.md`; non-zero exit if a gate fails. |
| `make seed-demo` | Load the PayWise demo org, users and vault into the **current** Supabase target |

---

## Environment

The env files already exist and are filled in. **Never read, print, log or commit secret values. Never edit `.env*` files** except the `.env.example` files, which you keep in sync, names only. Every service validates its env at startup and fails fast, naming the missing variable:
- web: `lib/env.ts` with zod
- worker: `settings.py` with pydantic-settings

**`apps/web/.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY            # server only, lib/supabase/admin.ts only
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_DEMO_MODE
DISCORD_WEBHOOK_URL
RESEND_API_KEY                 # optional, blank = email disabled
EMAIL_FROM
```

**`apps/worker/.env`**

```
SUPABASE_URL
SUPABASE_SECRET_KEY
DATABASE_URL                   # session pooler URI in cloud
PGMQ_QUEUE
LLM_PROVIDER
LLM_FALLBACK_PROVIDER
GROQ_API_KEY
GEMINI_API_KEY
GROQ_MODEL_TEXT
GROQ_MODEL_VISION
GEMINI_MODEL_TEXT
GEMINI_MODEL_VISION
EMBEDDING_MODEL
MODEL_CACHE_DIR
OCR_ENGINE
LANGFUSE_HOST                  # https://cloud.langfuse.com (EU) or https://us.cloud.langfuse.com
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
ENV
LOG_LEVEL
```

Tunable thresholds are **not** env vars. They live in `apps/worker/brandlens_worker/config.py` (see SPEC §14), so changes are versioned and visible to the eval gate.

---

## Architecture in 60 seconds

1. A creator saves a version and submits it with **intent** (goal, audience, CTA, channel, campaign).
2. The web route handler calls the SQL function `enqueue_review(version_id)`. That function checks membership, creates a `review_runs` row, and does `pgmq.send`.
3. The worker long-polls pgmq (`read_with_poll`) and runs the 6-stage pipeline:
   1. **Ingest:** parse into text with spans and bboxes.
   2. **Protect:** redact PII and secrets; drop "never send" vault items.
   3. **Filters:** deterministic checks (glossary, Fact Vault match scoped to the campaign, claims lexicon, tone heuristics, readability, WCAG contrast, ΔE, logo).
   4. **Retrieve:** bge-small + pgvector top-k over approved rule cards and facts, scoped to the org and campaign.
   5. **LLM pass:** **one** structured call returning findings and rewrites, conditioned on intent.
   6. **Citation gate:** keep a finding only if its cited IDs were retrieved for this run with a matching dimension and its quote is found in the text. Intent-verify each rewrite.
4. The worker writes `findings` and updates `review_runs`. The web UI updates live via Realtime.
5. The creator accepts, edits, dismisses (with a reason) or routes each finding. Workflow transitions go **only** through the SQL function `transition_content(...)`, which enforces the state machine and permissions and writes `audit_events`.

---

## Non-negotiable invariants (the "never cut" list)

Violating any of these is a bug, regardless of the phase.

1. **No uncited finding is ever shown.** The worker persists only findings that passed the citation gate. Deterministic findings cite their rule, fact or WCAG ID directly. The UI also refuses to render a finding with no `rule_id`, `fact_id` or `wcag_ref`.
2. **The LLM is untrusted.**
   - Draft text is passed as delimited data.
   - Output is schema-bound and validated with Pydantic.
   - Quotes are matched locally, and offsets are computed locally (never trust model offsets).
   - A quote that isn't found means the finding is dropped.
3. **Deterministic first.** Anything checkable without a model (glossary, facts, dates, venues, fees, contrast, ΔE, logo) is never delegated to the LLM.
4. **One LLM call per draft** for judgement dimensions. A second sample is allowed only to confirm blocker-severity LLM findings.
5. **Minimal context to external LLMs.** Send only the redacted draft chunk plus the top-k retrieved snippets. Never send the full vault, never send `never_send` items, and never send PII the redactor caught.
6. **Humans decide.**
   - No auto-publish, ever. `publish_ready` requires a recorded approval.
   - Blockers and findings with confidence < 0.6 can't be one-click accepted.
   - Overrides require a reason.
7. **All workflow state changes go through `transition_content()`.** No direct `UPDATE contents SET state = ...` anywhere. Every transition writes `audit_events` (actor, timestamp, reason).
8. **RLS on every table that has `org_id`.**
   - The secret key is used only in the worker and in `apps/web/lib/supabase/admin.ts` (server-only, imported only from route handlers or server actions that need it).
   - It never reaches the client bundle.
9. **Every finding records `model_version`, `prompt_version` and `source`.** Prompts live in `prompts/*.md` with a version header; changing a prompt bumps its version.
10. **Precision gate.** Any dimension under 85% precision on the golden set ships as `suggestion` severity only, controlled in `config.py` and enforced by `make eval` in CI.

---

## Coding conventions

**TypeScript**
- `strict`, no `any`. Validate server inputs with zod.
- Use server components by default and `"use client"` only where needed.
- Data access goes through typed Supabase clients using the generated `Database` types. Run `make types` after every migration.
- Mutations go through server actions or route handlers, never direct table writes from the client for workflow tables.
- Name files in kebab-case and components in PascalCase.

**Python**
- Type-hint everything; mypy-clean on `brandlens_worker/`.
- Pydantic models for every boundary: job payloads, LLM output, findings, config.
- Pure functions for each pipeline stage (`input → output`, no hidden I/O) so they can be unit-tested with fixtures. I/O lives in `jobs/`.
- Logging is structured JSON via `logging`. **Never log draft text or secrets at INFO**; log IDs and counts.

**SQL**
- Migrations are additive and timestamped, one concern per migration.
- RLS policies use the helpers `is_org_member(org_id)` and `has_org_role(org_id, roles[])`.
- Security-definer functions set `search_path = ''` and fully qualify names.
- Every new table gets a pgTAP RLS test (member can, non-member can't).

**Git**
- **Work directly on `main`** (user rule 2026-10-27). Don't create phase or UI branches or worktrees; what runs on localhost from the main checkout is what ships. The old `phase/*` and `ui/*` branches are history only.
- Conventional commits.
- Never commit `.env*` (other than `.env.example`), model caches or `node_modules`.
- AI-assisted code is disclosed in the README (General Rules 6–7). Keep the "AI assistance" section current.

**Errors**
- The worker never crashes on a bad job. Mark the run `failed` with an error code, `pgmq.archive` the message, and continue.
- If the LLM times out or is rate-limited after retries and fallback, return **deterministic findings only**, with `review_runs.degraded = true`. The UI shows a banner.

---

## Free-tier LLM etiquette (Groq and Gemini)

- Wrap every call in tenacity: exponential backoff on 429 and 5xx, max 3 attempts, then the fallback provider, then degraded mode.
- Respect `Retry-After`.
- `llm/cache.py` caches responses keyed by `sha256(provider, model, prompt_version, payload)`. Enable it in eval and tests (`LLM_CACHE=on` via config, not env) so CI doesn't burn quota on unchanged prompts.
- Unit tests **never** call real LLMs; use recorded fixtures or a fake provider. Only `make eval` hits real APIs.
- Model IDs come from env. Never hardcode them. If a model is unavailable, the error message names the env var to change.

---

## UI and UX conventions

All visual and interaction rules live in `docs/DESIGN.md`. It wins on look and feel; the invariants still win over it.

---

## Phase index

Full detail is in `docs/PHASES.md`. **M** = Maanit, **J** = Jagpreet.

| ID | Phase | Owner | Depends on | Milestone |
|---|---|---|---|---|
| P00 | Repo bootstrap and tooling | M | — | |
| P01 | Database schema, RLS, queue, seed | M | P00 | |
| P02 | Web shell, auth and demo role switcher | J | P01 | |
| P03 | Worker core: queue, LLM router, embeddings, tracing | M | P01 | |
| P04 | Brand vault ingestion and PayWise kit | M | P03 | |
| P05 | Vault admin UI | J | P02, P04 | |
| P06 | Pipeline stages 1–4 (ingest, protect, filters, retrieve) | M | P04 | |
| P07 | Pipeline stages 5–6 (LLM pass, citation gate, intent verification) | M | P06 | |
| P08 | Editor, intent capture and findings UI | J | P05, P07 | |
| P09 | Review workflow, routing, comments, diff, notifications | J + M | P08 | |
| P10 | Deploy and core-loop end-to-end | Both | P09 | **Day 7: core loop** |
| P11 | Image checks (vision) | M | P07 | |
| P12 | PDF decks and bbox overlays | M + J | P11, P08 | |
| P13 | GCS telemetry and insights dashboard | J + M | P09 | **Day 11: feature complete** |
| P14 | Golden set, eval gate and benchmarks | M | P07 (best after P12) | |
| P15 | Hardening: security, degraded mode, load, a11y | Both | P13, P14 | |
| P16 | Docs, disclosures, demo script, submission | J | P15 | **Day 14: submit** |

---

## Known gotchas

- **Supabase direct DB connections are IPv6-only.** In cloud, the worker must use the **session pooler** URI (port 5432). Use the transaction pooler (6543) only for stateless queries, never for pgmq long-polling.
- **pgmq:** the worker uses SQL directly (`pgmq.read_with_poll`, `pgmq.delete`, `pgmq.archive`). The web never touches pgmq; it calls `enqueue_review()`.
- **Next.js 16:** check the installed version's docs for request-time APIs. `cookies()`, `headers()` and `params` are async, and the old `middleware.ts` convention is `proxy.ts`. Read `node_modules/next/dist/docs` or the official docs before writing auth plumbing; don't rely on memory.
- **fastembed** downloads the model on first use. Bake it into the Docker image at build time (into `MODEL_CACHE_DIR`) so cold starts don't fetch it.
- **PaddleOCR** is heavy. Import it lazily inside `vision/ocr.py`, and fall back to Tesseract if it fails to import, OOMs, or `OCR_ENGINE=tesseract`.
- **Groq structured output** support varies by model. Request JSON schema mode where supported, otherwise JSON mode plus schema-in-prompt. **Always** validate with Pydantic, retry once with the validation error appended, then fall back.
- **TipTap offsets:** findings carry plain-text character offsets. Map them to ProseMirror positions with one tested util (`lib/editor/offsets.ts`). Never compute positions ad hoc in components.
- **Realtime** requires the table in the `supabase_realtime` publication, and RLS applies to Realtime too.
- **The demo data is fictional** (PayWise). Never seed real people's data. The four interviewees appear only in docs, never in the DB.
