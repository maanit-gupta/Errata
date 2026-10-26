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

## Changes since Round 1

See the "Deliberate deviations" table in [`CLAUDE.md`](CLAUDE.md). It is mirrored here before submission.

## AI assistance

Per General Rules 6–7, we disclose that this codebase is written with AI assistance. Claude Code (Anthropic) is used as a pair programmer for scaffolding, implementation and tests, working phase by phase from [`docs/PHASES.md`](docs/PHASES.md). Every change is reviewed and committed by a team member. The product's own runtime LLM use (Groq and Gemini) is documented separately on the in-app Services & AI-use page.

| Phase | AI-assisted work |
|---|---|
| P00 | Repo bootstrap: Makefile, web and worker scaffolds, env validation, CI |

## Licence

[AGPL-3.0](LICENSE), because PyMuPDF is AGPL. A dependency licence table will be generated from `PROGRESS.md` before submission.
