# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P10 partial (your deploy steps pending) → then tag `v0.7-core-loop`; P11 is unblocked
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | done | M (Claude) | phase/P01-schema | 2026-10-26 |
| P02 | Web shell, auth, demo switcher | J | done | M (Claude, /complete) | phase/P02-web-shell | 2026-10-26 |
| P03 | Worker core | M | done | M (Claude) | phase/P03-worker-core | 2026-10-26 |
| P04 | Vault ingestion & PayWise kit | M | done | M (Claude) | phase/P04-vault-ingestion | 2026-10-26 |
| P05 | Vault admin UI | J | done | M (Claude, /complete) | phase/P05-vault-ui | 2026-10-26 |
| P06 | Pipeline stages 1–4 | M | done | M (Claude) | phase/P06-pipeline-1-4 | 2026-10-26 |
| P07 | Stages 5–6: LLM, gate, intent | M | done | M (Claude) | phase/P07-llm-gate | 2026-10-26 |
| P08 | Editor & findings UI | J | done | M (Claude, /complete) | phase/P08-editor-findings | 2026-10-26 |
| P09 | Review workflow & notifications | J+M | done | M (Claude, /complete) | phase/P09-review-workflow | 2026-10-26 |
| P10 | Deploy & core-loop E2E 🎯 D7 | Both | partial | M (Claude, /complete) | phase/P10-deploy | cloud DB done; Render/Vercel = user steps |
| P11 | Image checks | M | todo | | | |
| P12 | PDF decks & overlays | M+J | todo | | | |
| P13 | GCS & insights 🎯 D11 | J+M | todo | | | |
| P14 | Golden set & eval gate | M | todo | | | |
| P15 | Hardening | Both | todo | | | |
| P16 | Docs & submission 🎯 D14 | J | todo | | | |

## Handoff (latest — overwrite each phase)

- **Phase / status:** P10 / **partial** (branch `phase/P10-deploy`, stacked on P09 → … → P00; none merged). Everything automatable is done and verified. Creating the Render and Vercel services (and entering their secrets) is yours.
- **⚠ Fix in `apps/worker/.env`:**
  1. **`DATABASE_URL` host is wrong.** The project is in **ap-southeast-1 (Singapore)**, not Mumbai. Use `aws-0-ap-southeast-1.pooler.supabase.com:5432` (session pooler); `ap-south-1` gives "tenant/user not found".
  2. Retired model IDs: `GROQ_MODEL_TEXT=openai/gpt-oss-120b`, `GROQ_MODEL_VISION=qwen/qwen3.8-27b`, `GEMINI_MODEL_TEXT=gemini-3.5-flash`, `GEMINI_MODEL_VISION=gemini-3.5-flash`.
  Every cloud run so far substituted both in-process.
- **Done (2026-10-26):**
  - **Cloud Supabase** (`BrandLens`, ref `stybifjeivqrmnsbjdia`, ap-southeast-1, PG 17): all **17 migrations pushed** (`supabase db push --db-url`), demo data seeded (`make seed-demo`: 6 users, 2 campaigns, 4 facts, 6 rules), and the vault embedded by a worker run against cloud.
  - Cloud hero review: the 4 expected deterministic findings plus an A-01 LLM suggestion, done in 4.6 s.
  - **Core-loop e2e against the cloud stack** (local `next dev` on `.env.local` + worker on cloud): **3/3 passed** (F02→F05, 44 s).
  - **`apps/worker/Dockerfile`:** python:3.12-slim, uv 0.9.9, `uv sync --frozen --no-dev`, **bge-small baked into `/app/.models` at build**, non-root `app` (uid 10001), `HEALTHCHECK /healthz`, honours `$PORT`. Built locally (2.8 GB unpacked). The container ran **healthy** against local Supabase and consumed `noop` jobs. Plus `.dockerignore`.
  - **`render.yaml` Blueprint:** `brandlens-worker`, Docker, `rootDir: apps/worker`, free plan, **singapore**, health check `/healthz`. Non-secret env is prefilled (queue, providers, working model IDs, model cache, `OCR_ENGINE=tesseract`, `ENV=production`); secrets are `sync: false`.
  - **Free-tier sleep:** the web's optional `WORKER_URL` env makes each submit ping `/healthz` via `after()`, and `.github/workflows/keepalive.yml` pings every 10 min when the repo variable `WORKER_URL` is set.
  - **`e2e/core-loop.spec.ts`** (runs with `E2E_WORKER=1` locally or `E2E_BASE_URL=https://…`); `review.spec.ts` keeps the local-only stale-decision test. Playwright `baseURL` honours `E2E_BASE_URL`.
  - **CI:** a new `worker-image` job builds the Docker image. pgTAP already runs. E2E is **manual** (needs the worker with LLM keys).
  - README "Running locally" and "Deploying" sections.
- **Your steps (exact; also in the README "Deploying" section):**
  1. Fix `apps/worker/.env` as above.
  2. **Render:** Dashboard → New → **Blueprint** → this repo (merge or push the branch first). Enter the secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` (Singapore session pooler), `GROQ_API_KEY`, `GEMINI_API_KEY`, `LANGFUSE_*`, and optionally `DISCORD_WEBHOOK_URL` + `SITE_URL`.
  3. **Vercel:** import the repo, Root Directory `apps/web`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEMO_MODE=true`, `DISCORD_WEBHOOK_URL`, `WORKER_URL`.
  4. In Supabase Auth → URL Configuration, set the Site URL and Redirect URLs to the Vercel URL.
  5. Set the GitHub repo variable `WORKER_URL`.
  6. Verify with `E2E_BASE_URL=https://<app>.vercel.app pnpm exec playwright test e2e/core-loop.spec.ts`, check the Render logs for `review done`, then `git tag v0.7-core-loop`.
- **Gotchas:**
  - zsh doesn't word-split unquoted `$VARS`, so use `--env-file` for `docker run`.
  - Render free = 512 MB. bge-small loads lazily (about 300 MB); switch to Starter if OOM. PaddleOCR (P11) won't fit, so keep `OCR_ENGINE=tesseract` there.
  - Every cloud and e2e run that reaches approved or publish-ready posts to the real Discord webhook.
- **Exact next step:** your deploy steps (above), then tag. Meanwhile **P11 (image checks)** is unblocked (deps P07), as are P12 and P14.

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
| 2026-10-26 | P03 | Review-queue messages without `type` default to `review_version`; vault messages use `job` | `enqueue_review()` (P01) sends `{run_id, version_id, org_id}` only |
| 2026-10-26 | P03 | Poison messages archived after 3 reads; failed runs send content `ai_check → draft` | Never strand content or loop forever on a crashing job |
| 2026-10-26 | P03 | Validation retry lives in `BaseProvider`; router treats `InvalidOutput` as non-retryable (→ fallback) | One retry with the error, per CLAUDE.md, then the other provider |
| 2026-10-26 | P03 | Validation-retry message lists field errors only, never the model's raw output | Raw output may quote draft text |
| 2026-10-26 | P03 | Langfuse generations record metadata (ids/counts/versions) as input, not prompts | Invariant 5 / "inputs logged as redacted text only" (stricter) |
| 2026-10-26 | P03 | Recommended model IDs: Groq `openai/gpt-oss-120b` (text), `qwen/qwen3.8-27b` (vision); Gemini `gemini-3.5-flash` | Configured models retired; these verified working 2026-10-26 |
| 2026-10-26 | P04 | CSV import = web route handler (`/api/vault/import`), zod-validated, RLS-scoped upsert, all-or-nothing | PHASES recommendation; no worker HTTP surface needed |
| 2026-10-26 | P04 | Extracted card whose code already exists → draft **version n+1** of that code | Re-ingesting a guide proposes updates instead of colliding on `unique(org_id, code, version)` |
| 2026-10-26 | P04 | Chunk budget 700 tokens (SPEC cap 1,500) | Real runs missed rules on 1,450-token chunks |
| 2026-10-26 | P04 | `embedding_source_hash` columns decide re-embedding | Covers in-place edits (e.g. examples appended in P13), not just new rows |
| 2026-10-26 | P04 | `enqueue_vault_job` allows the service role | `seed_demo.py` and the worker can queue embeddings |
| 2026-10-26 | P04 | Seed `source_page` values changed to match the generated `guide.pdf` | Citations must open the right page |
| 2026-10-26 | P05 | Approve/revise via SQL RPCs (`approve_rule_card`, `revise_rule_card`) | Archive-old + approve-new must be atomic under the one-approved-per-code index |
| 2026-10-26 | P05 | Editing an approved card creates version n+1 (old archived), drafts edit in place | Findings keep citing the exact text they were checked against |
| 2026-10-26 | P05 | Vault tabs and the card editor are URL state (`?tab=`, `&card=`) | Keyboard/back-button friendly, server-rendered, no client tab state |
| 2026-10-26 | P05 | Realtime client sets the JWT on the socket before subscribing; polling fallback while parsing | SSR client loads the session async; RLS drops events for anon sockets |
| 2026-10-26 | P05 | Managers/specialists are denied `/vault` (not read-only) | SPEC §2 allows "read-only or denied"; denied is simpler and safer |
| 2026-10-26 | P05 | `make test-db` resets the local DB first | pgTAP asserts seed state; local e2e mutates it |
| 2026-10-26 | P06 | F-112 missing-disclaimer check **merged** into the overlapping CL-03 finding (rule_id + fact_id) | One finding per issue; matches SPEC §16's "CL-03+F-112 blocker" |
| 2026-10-26 | P06 | Adjacent conflicting event entities become one finding; primary citation = this campaign's fact, bleed fact named in the explanation | "Oct 18 at Hall B, Chandigarh" is one mistake with one fix |
| 2026-10-26 | P06 | Reading grade only on drafts ≥60 words; exclamation check needs ≥2 "!" | Formulas and density are noise on one-line captions |
| 2026-10-26 | P06 | Tone banned phrasing = short quoted phrases in approved tone-rule bodies | Derives from the vault; no hardcoded list |
| 2026-10-26 | P06 | `Vault.facts` includes every org fact; scoping happens in the filter | Bleed detection needs the out-of-campaign facts |
| 2026-10-26 | P06 | Ruff ignores RUF001/002/003 | Brand copy and regexes deliberately use typographic characters |
| 2026-10-26 | P07 | Gate matches quotes on the unredacted whitespace-normalised `Doc.text`, mapped to original offsets at persistence | Same text the deterministic stages use; char map keeps spans exact |
| 2026-10-26 | P07 | Intent verification (§9) applies to LLM rewrites; deterministic rewrites are asserted to pass step 4 in tests | Code-generated fixes are correct by construction; cosine on long disclaimer rewrites would null good fixes |
| 2026-10-26 | P07 | Confirmation sample only when the main sample returns a blocker | SPEC §7 / CLAUDE.md deviation table |
| 2026-10-26 | P07 | Langfuse generation input = counts/ids only; output = finding count | Stricter than "redacted text" (invariant 5) |
| 2026-10-26 | P07 | Explicit SQL casts (`::uuid`, `::text`, `::real`) on RPC calls from the worker | psycopg binds floats as double precision; overload resolution failed |
| 2026-10-26 | P08 | Finding highlights are ProseMirror decorations, not marks | Never alter the saved text; they map through edits for free |
| 2026-10-26 | P08 | Version body = editor textblocks joined by `\n`; worker spans (code points) converted to UTF-16 in `offsets.ts` | One tested mapping; emoji-safe |
| 2026-10-26 | P08 | Accept/Edit apply the fix in the editor; the server only records status (audited by trigger) | Resubmitting creates the new immutable version (SPEC §4) |
| 2026-10-26 | P08 | Session load retries once on PGRST303 and throws (not /no-access) on query errors | Sub-second clock skew right after sign-in; errors must not masquerade as "no org" |
| 2026-10-26 | P09 | Worker sends Discord "needs review" for its own transitions (optional `DISCORD_WEBHOOK_URL`/`SITE_URL`); web sends the rest via `after()` | `→ in_review/specialist_review` is a worker transition; SPEC §15 assumed web-only |
| 2026-10-26 | P09 | Routed/dismissed findings carry over to identical findings on the next version | Otherwise a routed claim re-blocks every resubmit and never reaches Legal (§4/§10) |
| 2026-10-26 | P09 | Queue membership: manager = `in_review`; specialist = `specialist_review` of their kind; admin = all | SPEC §2/§10 |
| 2026-10-26 | P09 | Audit trail = `audit_events` filtered to the content and its versions (RLS-limited to manager/specialist/admin) | Single source; decisions also produce audit rows |
| 2026-10-26 | P09 | PGRST303 backoff (≤6 s) in `getSession` + Playwright global warm-up | Local Docker timing after idle; not reproducible on demand |
| 2026-10-26 | P10 | Worker host = **Render** free web service via `render.yaml` Blueprint (user decision) | Replaces Railway/Fly in CLAUDE.md "Delivery" |
| 2026-10-26 | P10 | Supabase region is ap-southeast-1 (Singapore), Render region singapore | Actual project region (not Mumbai as planned) |
| 2026-10-26 | P10 | Free-tier sleep mitigated by submit-time `/healthz` ping (`WORKER_URL`) + 10-min GitHub keep-alive | Free web services stop the consumer when idle |
| 2026-10-26 | P10 | E2E is manual in CI; `worker-image` job builds the Docker image | E2E needs LLM keys and a running worker |

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
| @tiptap/react, @tiptap/pm, @tiptap/starter-kit | MIT | P08 |
| diff | BSD-3-Clause | P09 |
| httpx (promoted from dev to runtime, worker) | BSD-3-Clause | P09 |

## Open questions (ask the user; don't guess)

- [ ] Build window Day-1 date?
- [x] Worker host: **Render** (Dockerfile + `render.yaml` Blueprint, free tier), user decision 2026-10-26.
- [x] Cloud Supabase: user approved pushing migrations + demo seed (2026-10-26).
- [ ] Is Resend email wanted, or Discord only?
- [ ] **Update model IDs in `apps/worker/.env`** (see the P03 handoff; the configured Groq/Gemini models are retired).

## Known issues / debt

_none yet_

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
