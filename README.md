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

To load the same data into the cloud project: `make seed-demo url=<SUPABASE_URL>`. The URL must match `apps/worker/.env`. Re-running is safe; existing rows are never overwritten.

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

## Licence

[AGPL-3.0](LICENSE), because PyMuPDF is AGPL. A dependency licence table will be generated from `PROGRESS.md` before submission.
