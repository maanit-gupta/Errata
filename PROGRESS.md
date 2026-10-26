# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P00 done → next P01
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | todo | | | |
| P02 | Web shell, auth, demo switcher | J | todo | | | |
| P03 | Worker core | M | todo | | | |
| P04 | Vault ingestion & PayWise kit | M | todo | | | |
| P05 | Vault admin UI | J | todo | | | |
| P06 | Pipeline stages 1–4 | M | todo | | | |
| P07 | Stages 5–6: LLM, gate, intent | M | todo | | | |
| P08 | Editor & findings UI | J | todo | | | |
| P09 | Review workflow & notifications | J+M | todo | | | |
| P10 | Deploy & core-loop E2E 🎯 D7 | Both | todo | | | |
| P11 | Image checks | M | todo | | | |
| P12 | PDF decks & overlays | M+J | todo | | | |
| P13 | GCS & insights 🎯 D11 | J+M | todo | | | |
| P14 | Golden set & eval gate | M | todo | | | |
| P15 | Hardening | Both | todo | | | |
| P16 | Docs & submission 🎯 D14 | J | todo | | | |

## Handoff (latest — overwrite each phase)

- **Phase / status:** P00 / done (branch `phase/P00-bootstrap`, not yet merged to `main`).
- **What exists now:**
  - Root: `Makefile` (every CLAUDE.md target; `make help` lists them), pnpm workspace (`pnpm-workspace.yaml`, root `package.json` proxies to make), AGPL-3.0 `LICENSE`, stub `README.md` with the AI-assistance section, `.github/workflows/ci.yml` (`make lint` + `make test-worker test-web` on PRs/pushes to main; pgTAP and eval jobs are commented placeholders), `supabase/config.toml` (`project_id = "brandlens"`, Postgres 17, no migrations yet).
  - `apps/web`: Next.js 16.4.3 / React 19.3, TS strict, Tailwind v4, ESLint, Prettier (+tailwind plugin), shadcn/ui (`base-nova` style, neutral, Base UI primitives, `cn` helper from shadcn's `cn` package), Vitest (`lib/__tests__/env.test.ts`), Playwright config (`e2e/` empty). `cacheComponents: true` from the template.
  - Web env: `lib/env-schema.ts` (pure zod schemas + `parseEnv`, value-free `EnvError`) and `lib/env.ts` (`clientEnv` constant with literal `NEXT_PUBLIC_*` refs; `serverEnv()` memoised, throws in the browser). Validated in **both** `instrumentation.ts` (fails `next dev`/`next start` at boot) and `app/layout.tsx` (fails `next build`).
  - `apps/worker`: uv project on Python 3.12 (`.python-version`), all P00 deps, `brandlens_worker/settings.py` (pydantic-settings; `get_settings()` cached, `load_settings(**overrides)` raises a value-free `SettingsError` naming each bad var; secrets are `SecretStr`), `config.py` (SPEC §14 constants, `RISK_WEIGHTS` from §10), `main.py` (`create_app(settings=None)` factory with `GET /healthz` → `{status, env, provider}`). 9 pytest tests (settings, healthz, config).
  - `.env.example` for both apps, names matching CLAUDE.md.
- **Stubbed or deferred:** `make eval` (P14), `make seed-demo` (P01), `make e2e` (no-op until a spec exists, P10), `make test-db` (no-op until `supabase/tests/*.sql` exist, P01). No structured JSON logging yet (just `basicConfig`; P03). `/checkpoint` command referenced in CLAUDE.md does not exist in `.claude/commands/` yet. `docs/plan.pdf` was already in place.
- **How to run / verify:** `make setup && make check` (verified on a fresh clone with no env files). `make dev` → http://localhost:3000 (default Next page) and http://localhost:8000/healthz (200). Fail-fast: `GROQ_API_KEY= make dev-worker` or `SUPABASE_SECRET_KEY= make dev-web` exits naming the var (a blank process env var overrides the file, so you never need to edit `.env*`).
- **Gotchas discovered:**
  - Worker must run as `uvicorn --factory brandlens_worker.main:create_app`; there is no module-level `app`, so importing `main` in tests/CI never reads env.
  - Worker tests use the `worker_env` fixture + `load_settings(_env_file=None)`; they never read the real `.env`.
  - `pnpm typecheck` runs `next typegen` first (needed for the global `LayoutProps`/`PageProps` types).
  - `apps/worker/.env` has an extra `LANGFUSE_BASE_URL` not in CLAUDE.md; settings use `extra="ignore"`. Decide in P03 whether the Langfuse SDK wants it instead of `LANGFUSE_HOST`.
  - `LOG_LEVEL` in env is lowercase (`info`); settings upper-case it.
  - Next 16 writes `apps/web/AGENTS.md` on `next dev`; it's committed so the tree stays clean.
  - macOS has no `timeout` command; Docker daemon wasn't running this session (not needed for P00, needed for P01 `make db-start`).
  - pnpm 12 + uv were installed via Homebrew this session (Node is v26 via nvm; CI uses Node 22).
  - Starlette warns that `httpx` + TestClient is deprecated in favour of `httpx2`; the warning is filtered in `pyproject.toml`. Adding `httpx2` was blocked by the permission classifier, so that's left for a human decision.
- **Exact next step:** Merge `phase/P00-bootstrap` into `main` (PR, reviewed by Jagpreet). Then `/clear` → `/next` runs **P01** (DB schema, RLS, queue, seed): start Docker, `make db-start`, then `make db-new name=...` per migration.

## Decisions log (append-only)

| Date | Phase | Decision | Why |
|---|---|---|---|
| 2026-10-26 | pre | Groq primary, Gemini fallback (free tiers) | No paid LLM budget |
| 2026-10-26 | pre | Email/password auth + demo role switcher; no OAuth | Simpler; judge-friendly |
| 2026-10-26 | pre | Discord webhook instead of Slack | Team preference |
| 2026-10-26 | pre | Langfuse Cloud instead of self-hosted | Dev speed; demo data is fictional |
| 2026-10-26 | pre | Next.js 16 instead of 15 | Current stable |
| 2026-10-26 | pre | Second LLM sample only for blocker findings | Resolves the plan's one-call vs two-sample contradiction |
| 2026-10-26 | P00 | Env validated in `instrumentation.ts` (boot) **and** root layout (build) | Instrumentation alone misses `next build`; layout alone only fails on first request in dev |
| 2026-10-26 | P00 | Pure `lib/env-schema.ts` split from eager `lib/env.ts` | Lets Vitest test schemas without a real env |
| 2026-10-26 | P00 | Worker app built via `create_app()` factory (`uvicorn --factory`) | Settings validated at startup, while tests/CI import without env |
| 2026-10-26 | P00 | Blank env values count as missing (web and worker) | Lets you verify fail-fast via `VAR= make dev-*` without editing `.env*` |
| 2026-10-26 | P00 | `LLM_FALLBACK_PROVIDER` accepts `groq`/`gemini`/`none` | Allows disabling the fallback explicitly |
| 2026-10-26 | P00 | `make dev` uses `make -j2` rather than a `concurrently` dep | One fewer dependency |
| 2026-10-26 | P00 | shadcn `base-nova` preset (Base UI primitives, `cn` package) | Current shadcn default; restyled in P02 |
| 2026-10-26 | P00 | Kept `httpx` for TestClient and filtered the starlette deprecation warning | Adding `httpx2` was blocked by the permission classifier; revisit if needed |

**Dependencies and licences** (append when adding any dependency):

| Package | Licence | Added in |
|---|---|---|
| PyMuPDF | AGPL-3.0 | P00 |
| fastapi, pydantic, pydantic-settings, supabase, langfuse, python-docx, textstat | MIT | P00 |
| uvicorn, numpy, httpx (dev) | BSD-3-Clause | P00 |
| psycopg (binary, pool) | LGPL-3.0 | P00 |
| tenacity, fastembed, groq, google-genai, trafilatura | Apache-2.0 | P00 |
| pyahocorasick | BSD-3-Clause + Public Domain | P00 |
| pytest, ruff, mypy (dev) | MIT | P00 |
| pytest-asyncio (dev) | Apache-2.0 | P00 |
| next, react, react-dom, zod, tailwindcss, @base-ui/react, cn, shadcn, tw-animate-css | MIT | P00 |
| lucide-react | ISC | P00 |
| class-variance-authority | Apache-2.0 | P00 |
| eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss, vitest (dev) | MIT | P00 |
| typescript, @playwright/test (dev) | Apache-2.0 | P00 |

## Open questions (ask the user; don't guess)

- [ ] Build window Day-1 date?
- [ ] Worker host: Railway or Fly? (Needed by P10.)
- [ ] Does the Supabase cloud project already exist (Mumbai)? Is its URL in the env files?
- [ ] Is Resend email wanted, or Discord only?

## Known issues / debt

_none yet_

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
