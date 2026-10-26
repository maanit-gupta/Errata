# BrandLens

**Pre-publication brand governance.** Every draft (text, doc, image, PDF) is checked against an organisation's approved rule cards, facts and assets, and every flag cites the rule or fact ID it was checked against. Humans approve; BrandLens never publishes.

> 🚧 **Under construction.** This is a hackathon build (Inkloom AI brand-governance problem statement, Round 2). Live status is in [`PROGRESS.md`](PROGRESS.md); the build spec is [`docs/SPEC.md`](docs/SPEC.md).

## Quick start

Requires Node 22+, pnpm, [uv](https://docs.astral.sh/uv/), the Supabase CLI and Docker.

```bash
make setup   # pnpm install + uv sync
make dev     # web on :3000, worker on :8000 (GET /healthz)
make check   # lint + types + tests
```

Copy `apps/web/.env.example` → `apps/web/.env.local` and `apps/worker/.env.example` → `apps/worker/.env`, then fill them in. Both services refuse to start if a variable is missing and name it.

## Running locally

```bash
make setup && make models   # deps + the bge-small embedding model
make db-start && make db-reset
make dev-local              # web :3000 + worker :8000 against the LOCAL Supabase stack
```

`make dev` runs against whatever `apps/*/.env*` point at (the cloud project). E2E:
`cd apps/web && E2E_WORKER=1 pnpm exec playwright test` (needs `make dev-local`); add `E2E_LLM=1` for the live guide-upload test.

## Deploying

**Live:** web https://brandlens-app.vercel.app (Vercel project `brandlens`), worker https://brandlens-worker.onrender.com (Render service `brandlens-worker`). Both deploy automatically on every push to `main`. The steps below are for recreating them from scratch.

Supabase project: `BrandLens`, **ap-southeast-1 (Singapore)**. Migrations: `supabase db push --db-url <session-pooler-URI>`; demo data: `make seed-demo url=<SUPABASE_URL>` (then any running worker embeds the vault).

**Worker → Render** (free tier, Docker):
1. Render Dashboard → **New → Blueprint** → select this repo. `render.yaml` defines `brandlens-worker` (Docker, `apps/worker`, Singapore, health check `/healthz`).
2. Fill the `sync: false` secrets when prompted: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` (**session pooler**, `aws-0-ap-southeast-1.pooler.supabase.com:5432`), `GROQ_API_KEY`, `GEMINI_API_KEY`, `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and optionally `DISCORD_WEBHOOK_URL` + `SITE_URL` (the Vercel URL).
3. Free web services sleep after ~15 min idle, which pauses the queue consumer. Set the web env `WORKER_URL` (each submit pings `/healthz`) and the GitHub repo variable `WORKER_URL` (the `keepalive.yml` workflow pings every 10 min). If the 512 MB instance runs out of memory, switch the plan to Starter.

**Web → Vercel:** import the repo, **Root Directory `apps/web`** (pnpm detected). Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL` (the Vercel URL), `NEXT_PUBLIC_DEMO_MODE=true`, `DISCORD_WEBHOOK_URL`, `WORKER_URL`, optional `RESEND_API_KEY`/`EMAIL_FROM`. Then in Supabase → Authentication → URL Configuration set **Site URL** and add the Vercel URL to **Redirect URLs**.

**Verify:** `cd apps/web && E2E_BASE_URL=https://<your-app>.vercel.app pnpm exec playwright test e2e/core-loop.spec.ts`, and check the Render logs for `review done`.

## Local database and demo accounts

```bash
make db-start   # local Supabase (Docker). API on :55321, Postgres on :55322, Studio on :55323
make db-reset   # apply supabase/migrations/* from zero, then supabase/seed.sql
make test-db    # pgTAP: RLS, state machine, queue, retrieval
make types      # regenerate apps/web/types/database.ts
```

Local ports are shifted to the 553xx range so BrandLens can run next to another local Supabase project.

The seed creates the fictional **PayWise** org (SPEC §16). Every demo account uses the password **`PayWise-demo-2026`** (demo only; never reuse it):

| Email | Role |
|---|---|
| `admin@paywise.demo` | brand admin |
| `creator@paywise.demo` | creator |
| `agency@paywise.demo` | agency creator |
| `manager@paywise.demo` | manager |
| `legal@paywise.demo` | specialist (legal) |
| `a11y@paywise.demo` | specialist (accessibility) |

To load the same data into the cloud project: `make seed-demo url=<SUPABASE_URL>`. The URL must match `apps/worker/.env`. Re-running is safe; existing rows are never overwritten. It also uploads the PayWise logo files that the image checks match against; locally, run `make seed-assets-local` after every `make db-reset`.

Image checks need the Tesseract binary (`brew install tesseract`, or `apt-get install tesseract-ocr`; the worker Docker image includes it). `make eval-vision` re-measures them on the 10 labelled creatives in `fixtures/paywise/creatives/` and writes `apps/worker/eval/vision_report.md`.

## Changes since Round 1

See the "Deliberate deviations" table in [`CLAUDE.md`](CLAUDE.md). It is mirrored here before submission.

## AI assistance

Per General Rules 6–7, we disclose that this codebase is written with AI assistance. Claude Code (Anthropic) is used as a pair programmer for scaffolding, implementation and tests, working phase by phase from [`docs/PHASES.md`](docs/PHASES.md). Every change is reviewed and committed by a team member. The product's own runtime LLM use (Groq and Gemini) is documented separately on the in-app Services & AI-use page.

| Phase | AI-assisted work |
|---|---|
| P00 | Repo bootstrap: Makefile, web and worker scaffolds, env validation, CI |
| P01 | Database migrations, RLS policies, workflow SQL functions, pgTAP tests, demo seed scripts |
| P02 | Web shell: design tokens, shared components, Supabase auth, demo role switcher, permissions matrix, a11y e2e tests |
| P03 | Worker core: pgmq consumer, LLM router with fallback and validation retry, response cache, embeddings, Langfuse tracing |
| P04 | PayWise demo kit (guide, CSVs, logos), guide parsing and LLM rule extraction, vault embeddings, CSV import route |
| P05 | Vault admin UI (rule cards, facts, glossary, campaigns, assets, guides), approve/revise SQL functions, live updates |
| P06 | Review pipeline stages 1–4: ingest, PII/secret redaction, deterministic filters (terms, facts and campaign bleed, claims, tone, access), retrieval, routing |
| P07 | LLM review pass, citation gate, confidence scoring, intent verification of rewrites, degraded mode, tracing |
| P08 | Draft editor (TipTap) with live finding highlights, intent capture, findings panel with accept/edit/dismiss/route, offsets util and tests |
| P09 | Review queue and reviewer view, decisions via transition_content, version diff, comments, audit trail, Discord/email notifications |
| P10 | Worker Dockerfile, Render Blueprint, cloud migrations and seed, core-loop e2e (local and cloud), keep-alive |
| P11 | Image checks: OCR (Tesseract, optional Paddle), logo detection (ORB + template), WCAG contrast, palette ΔE, warmth pre-filter, vision LLM pass and gate, labelled test creatives and vision eval, image viewer with bbox overlays |

## Licence

[AGPL-3.0](LICENSE), because PyMuPDF is AGPL. A dependency licence table will be generated from `PROGRESS.md` before submission.
