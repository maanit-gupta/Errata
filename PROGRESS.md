# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P02 done → next P03
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | done | M (Claude) | phase/P01-schema | 2026-10-26 |
| P02 | Web shell, auth, demo switcher | J | done | M (Claude, /complete) | phase/P02-web-shell | 2026-10-26 |
| P03 | Worker core | M | in-progress | M (Claude) | phase/P03-worker-core | |
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

- **Phase / status:** P02 / done (branch `phase/P02-web-shell`, stacked on P01 → P00; none merged to `main` yet). Built by Claude for Jagpreet's phase under `/complete`; Jagpreet should review the UI.
- **What exists now (web):**
  - **Tokens** in `app/globals.css`: palette per CLAUDE.md, a dark set (OS preference or `.dark`/`.light` on `<html>`), severity colours (`blocker`, `warning`, `suggestion` + `-surface`), `accent-text` for vermilion *text* (the `#D63A24` fill is only 4.37:1 as text on off-white), and a global `:focus-visible` ring. The `dark:` variant follows the OS too.
  - **Fonts** (`next/font`): Newsreader (`font-heading`), DM Sans (`font-sans`), JetBrains Mono (`font-mono`).
  - **Components:** `IdBadge` (mono, optional link), `SeverityBadge`, `StateBadge` (+ `STATE_LABELS`), `EmptyState`, `PageHeader`, `NoAccess`, `AppNav` (client, `aria-current`), `DemoRoleSwitcher`. shadcn `input`, `label`, `dropdown-menu`, `card` and `separator` were added (Base UI).
  - **Supabase:**
    - `lib/supabase/browser.ts` and `server.ts` (async `cookies()`; setAll swallowed in RSC).
    - `admin.ts` (`server-only`, secret key; nothing imports it yet).
    - `lib/supabase/proxy.ts` + root `proxy.ts`: refresh via `getClaims()`, signed-out → `/login?next=…`, signed-in at `/login` → `/drafts`, refreshed cookies carried onto redirects.
  - **Auth:** `lib/auth/session.ts` has `getSession()` (React `cache`, first membership + org name + profile) and `requireSession()` (→ `/login` or `/no-access`). `lib/auth/actions.ts` has `signIn` (zod, `useActionState`, safe `next`), `signInAsDemo` (server-side password, refuses unless `NEXT_PUBLIC_DEMO_MODE`) and `signOut`. `lib/auth/demo-users.ts` lists the six seeded users (emails only).
  - **Permissions:** `lib/workflow/permissions.ts` has `MATRIX`, `access()`, `can()`, `navFor()`, `homeFor()` and `roleLabel()`. Vitest checks all 45 matrix cells against a ●/◐/○ transcription of SPEC §2, plus nav.
  - **Pages:** `/login` (form + "Try a demo role" panel, hidden when demo mode is off), `(app)` layout (skip link, header with org and role pill, switcher, sign-out, left nav filtered by role), and placeholder `/drafts` (specialists redirect to `/review`), `/review`, `/vault`, `/insights` (role-gated with `NoAccess`), `/settings`, `/settings/ai-use` (static SPEC §18 table and AI-use notes; the models list is a placeholder) and `/no-access`.
  - **E2E** `e2e/auth.spec.ts` (18 tests): redirects both ways, the error state, `?next`, one-click sign-in and exact nav for all six roles, the switcher, sign-out, the admin-page gate, and axe WCAG 2.2 AA with zero violations on `/login`, `/drafts` and `/settings/ai-use`, in light and dark.
  - `pnpm check:bundle` (`apps/web/scripts/check-client-bundle.mjs`) scans `.next/static` for secret **values**. After `pnpm build` it found 0 leaks.
  - `make dev-local` / `make dev-web-local` run against the local Supabase stack. `scripts/local-supabase-env.sh` exports local URL/keys in-process, so no `.env*` edits are needed.
- **Stubbed or deferred:** real data on every page (P05/P08/P09/P13). The AI-use models list (wire it to the latest `review_runs` in P08/P13). Multi-org selection (the first membership wins). The `dropdown-menu`, `card` and `separator` primitives aren't used yet.
- **How to verify:** `make db-start && make db-reset`, then `make dev-web-local`, then `cd apps/web && pnpm exec playwright test`. Bundle check: `cd apps/web && pnpm build && pnpm check:bundle`.
- **Gotchas discovered:**
  - `cacheComponents` (and `partialPrefetching`) are now **off**. With them on, every `cookies()` read outside `<Suspense>` is a build error; this app is per-user dynamic everywhere.
  - Next's route announcer is also `role="alert"`, so target app alerts by id in Playwright.
  - The cloud Supabase project doesn't have the schema yet. `.env.local` points at cloud, so `make dev-web` against cloud will fail at sign-in until migrations are pushed (P10). Use `make dev-web-local`.
  - Lighthouse itself wasn't run. axe-core with the WCAG 2.2 AA tags (zero violations, light and dark) stands in for the "Lighthouse a11y ≥ 95" check.
- **Exact next step:** P03 (worker core: pgmq consumer, LLM router with Groq → Gemini fallback, fastembed embeddings, Langfuse tracing, structured logging).

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
| 2026-10-26 | P01 | Local Supabase ports 543xx → 553xx | Another local Supabase stack holds the defaults; we don't stop other projects |
| 2026-10-26 | P01 | Added `decisions.finding_id` (override decisions point at the warning they override) | §4 requires an override per open warning; also feeds GCS ReviewerOverrideRate (§11) |
| 2026-10-26 | P01 | Rule table lives in `private.apply_transition`; both public entry points and `enqueue_review` call it | One rule table for user and worker transitions (§4) |
| 2026-10-26 | P01 | `transition_content` takes optional `p_route_to` (manual escalation); `transition_content_system` takes `p_route_to`, `p_risk_score` | Worker computes §10 from config.py weights; SQL applies the redirect |
| 2026-10-26 | P01 | Added system transition `ai_check → draft` (reason required) | A failed run must not strand content in ai_check |
| 2026-10-26 | P01 | Workflow-column guard uses a txn-local GUC set only inside definer functions | Blocks direct `state` writes from every client, including manual SQL as non-superuser roles |
| 2026-10-26 | P01 | Users update findings via column grants (`status`, `dismiss_reason`, `dismiss_note`); trigger stamps resolver and audits | Minimal surface; no free-form edits of worker output |
| 2026-10-26 | P01 | `match_vault` is service-role only and also returns `content`/`value` | It returns rule bodies, which agencies must not see; the worker needs the snippet text |
| 2026-10-26 | P01 | At most one `approved` version per rule code (partial unique index) | Retrieval and citations must resolve to exactly one card |
| 2026-10-26 | P01 | `drafts/` and `renders/` paths carry the content id as segment 2 | Lets storage RLS apply agency "own content only" rules |
| 2026-10-26 | P01 | Added `enqueue_vault_job()` for `vault_jobs` | Web never touches pgmq directly (CLAUDE.md gotcha) |
| 2026-10-26 | P01 | E-19 `valid_until` = campaign end (2026-11-15), not event day | Demo must still retrieve E-19 after Oct 28 |
| 2026-10-26 | P01 | Demo password `PayWise-demo-2026`, fixed UUIDs, cloud users created with the same ids | Local and cloud demo data are identical; documented in README |
| 2026-10-26 | P01 | Campaigns writable by manager and brand_admin | SPEC §2 is silent; managers run campaigns |
| 2026-10-26 | P02 | Turned off `cacheComponents`/`partialPrefetching` | Every page reads the session; Suspense-wrapping every read buys nothing for an authenticated tool |
| 2026-10-26 | P02 | `can()` is boolean over a tri-state `access()` (`full`/`limited`/`none`); footnoted ● counts as `limited` | UI gating needs "at all?" plus "scoped?" |
| 2026-10-26 | P02 | Specialists land on `/review` (no Drafts nav); everyone else on `/drafts` | Specialists can't submit content (SPEC §2) |
| 2026-10-26 | P02 | Demo role switcher is a labelled `<select>` + Switch button | Change-on-select violates WCAG 3.2.2 |
| 2026-10-26 | P02 | Demo password lives only in the server action module | It's documented, but still never shipped to the browser |
| 2026-10-26 | P02 | axe-core (WCAG 2.2 AA tags) in Playwright stands in for Lighthouse | Automatable in CI; covers the same a11y rules |

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
| @supabase/ssr, @supabase/supabase-js, server-only, sonner | MIT | P02 |
| @axe-core/playwright (dev) | MPL-2.0 | P02 |

## Open questions (ask the user; don't guess)

- [ ] Build window Day-1 date?
- [ ] Worker host: Railway or Fly? (Needed by P10.)
- [ ] Does the Supabase cloud project already exist (Mumbai)? Is its URL in the env files?
- [ ] Is Resend email wanted, or Discord only?

## Known issues / debt

_none yet_

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
