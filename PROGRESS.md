# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P01 done → next P03 (M) / P02 (J)
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | done | M (Claude) | phase/P01-schema | 2026-10-26 |
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

- **Phase / status:** P01 / done (branch `phase/P01-schema`, stacked on `phase/P00-bootstrap`; neither merged to `main` yet).
- **What exists now:**
  - `supabase/migrations/` holds 15 migrations, one concern each (`20261026100001`…`100015`): extensions, enums, tenancy, vault, content, collaboration, indexes (HNSW + FK B-trees), helpers, RLS, workflow, queues, `match_vault`, storage, realtime, profile-on-signup.
  - **RLS helpers** (public, security definer): `is_org_member`, `has_org_role`, `is_org_staff` (every role but agency), `can_read_content`, `can_read_version`, `can_edit_content` (owner/admin while `draft`/`needs_revision`), `can_act_on_version` (owner/admin; manager while `in_review`; matching specialist while `specialist_review`), `version_org`, `storage_path_uuid`, `storage_content_in_org`.
  - **Workflow:** `private.apply_transition` holds the §4 rule table. Entry points:
    - `transition_content(content, to, reason?, route_to?)` for authenticated users. It refuses `ai_check`. `route_to` is used for manual escalation `in_review → specialist_review`.
    - `transition_content_system(content, to, reason?, route_to?, risk_score?)`, service role only. `in_review` auto-redirects to `specialist_review` when `route_to ≠ manager`. `ai_check → draft` (with a reason) handles failed runs.
    - The `contents_guard` trigger rejects writes to `state`, `route_to`, `risk_score`, `current_version_id`, `owner_id`, `org_id` and `campaign_id` unless the txn-local GUC `brandlens.workflow_write='on'` (set only by definer functions).
    - Every transition writes `audit_events`. approve, request_changes, sign_off, mark_ready and archive also write `decisions`.
  - **Versions:** `n` is auto-numbered, `created_by` defaults to `auth.uid()`, and inserting one sets `contents.current_version_id` and supersedes open findings on older versions whose quote vanished. They're immutable (trigger plus revoked UPDATE grant).
  - **Findings:** users may UPDATE only `status`, `dismiss_reason` and `dismiss_note` (column grants). A trigger stamps `resolved_by`/`resolved_at`, clears the dismiss fields when not dismissed, forbids manual `superseded`, and audits every change. CHECKs enforce a citation and that dismissals have a reason.
  - **Overrides:** `decisions.finding_id` (new column). A manager/specialist/admin inserts an `override` decision (reason required) per open warning; `in_review → approved` is blocked until every open warning on the current version has one.
  - **Queues:** `review_jobs`, `vault_jobs`. `enqueue_review(version)` checks it's the current version, that intent is complete (§5, `campaign_id` must match), and from `needs_revision` that no blocker on the latest done run is open. It then inserts the queued run, transitions, and sends `{run_id, version_id, org_id}`. `enqueue_vault_job(org, job, payload)` is admin only; jobs are `ingest_guide`, `embed_vault` and `generate_examples`.
  - **`match_vault`** is service role only and returns `(id, code, kind 'rule'|'fact', dimension, title, content, severity, value, similarity)`. It takes approved non-`never_send` rules plus org-wide or matching-campaign, unexpired, non-`never_send` facts (facts count as dimension `facts`), with top-k from each side merged.
  - **Storage:** private buckets `guides`, `assets`, `drafts` and `renders`. Paths: `guides|assets/{org}/…`, `drafts/{org}/{content}/{n}/…`, `renders/{org}/{content}/…`. Drafts allow insert and read only.
  - **Realtime:** `review_runs`, `findings`, `contents`, `comments`.
  - `supabase/seed.sql` has the PayWise org with fixed UUIDs (org `…00a1`, users `10000000-…-00000000000{1..6}`, campaigns `20000000-…-00{1,2}`), the 6 users (password `PayWise-demo-2026`, in the README), memberships, glossary G-07, facts F-048/F-112/E-19/E-11 and rule cards TV-02/TV-04/CL-03/G-07/VS-02/A-01 (approved, no embeddings).
  - `scripts/demo_data.py` is the Python copy of the seed. `apps/worker/tests/test_demo_data.py` asserts it matches `seed.sql`.
  - `scripts/seed_demo.py` (`make seed-demo url=…`) uses the admin API with fixed user ids and insert-if-missing. It refuses unless `--url` equals `SUPABASE_URL` and `--yes` is given. Verified: `db reset --no-seed`, then `seed_demo.py`, then the full pgTAP suite passes; a re-run is a no-op.
  - pgTAP `supabase/tests/00–03` (69 assertions): RLS on every table, member/non-member/agency/anon access, the full state machine incl. guards, wrong roles and audit, direct-update rejection, `enqueue_review` + queue message, and `match_vault` scoping.
  - `apps/web/types/database.ts` generated (`make types`); the web typechecks. CI now has a `pgtap` job (`supabase db start` → `test db` → `db lint`).
- **Stubbed or deferred:** embeddings (P04); `rule_gcs` view (P13, SPEC §11); notifications; no `set_finding_status` RPC (direct column-granted UPDATE works; P08 may wrap it). The "blockers / confidence < 0.6 can't be one-click accepted" rule is UI-side (P08); the DB only requires a dismiss reason.
- **How to verify:** `make db-start && make db-reset && make check` (`make check` includes pgTAP). Demo login: `creator@paywise.demo` / `PayWise-demo-2026` against the local API (:55321).
- **Gotchas discovered:**
  - **Local Supabase ports moved to 553xx** (API 55321, DB 55322, Studio 55323, Inbucket 55324), because another local Supabase project (TurfX) holds 543xx on this machine. The env files point at cloud, so nothing else changed.
  - RLS with no UPDATE policy silently updates 0 rows. Where a hard error matters (versions, runs, findings, decisions, audit) the table grants are revoked too.
  - RLS `WITH CHECK` runs after BEFORE triggers, so trigger-filled columns (e.g. `versions.created_by`) satisfy policies.
  - pgTAP tests impersonate via `set local role authenticated; set local request.jwt.claims to '{"sub":…}'` and carry ids across role switches with `set_config('test.x', …, true)`.
  - The `audit_events` append-only trigger also blocks the cascade when an org is deleted, so orgs with history can't be hard-deleted (intended).
  - `make fmt` stops at `ruff check --fix` if any error is unfixable; run `uv run ruff format` directly in that case.
- **Exact next step:** P03 (worker core: queue consumer, LLM router, embeddings, tracing) for M. P02 (web shell, auth, demo switcher) is unblocked for J. Merge P00 → P01 into `main` via PR when Jagpreet has reviewed.

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
