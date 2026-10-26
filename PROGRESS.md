# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P04 done → next P05
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
| P05 | Vault admin UI | J | in-progress | M (Claude, /complete) | phase/P05-vault-ui | |
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

- **Phase / status:** P04 / done (branch `phase/P04-vault-ingestion`, stacked on P03 → … → P00; none merged).
- **⚠ Still open for Maanit:** update the retired model IDs in `apps/worker/.env` (see Open questions). Every live run below used process overrides: `GROQ_MODEL_TEXT=openai/gpt-oss-120b GROQ_MODEL_VISION=qwen/qwen3.8-27b GEMINI_MODEL_TEXT=gemini-3.5-flash GEMINI_MODEL_VISION=gemini-3.5-flash`.
- **What exists now:**
  - **PayWise kit** in `fixtures/paywise/`:
    - `guide.md` → `guide.pdf` (4 pages, real headings and page numbers). TV-02 and TV-04 are on p1, G-07 and CL-03 on p2, VS-02 and A-01 on p3. TV-04 is deliberately vague.
    - `facts.csv`, `glossary.csv` and the kit `README.md`.
    - `logos/` has the primary, reversed and mark variants as SVG plus rendered PNG.
    - Rebuild with `cd apps/worker && uv run python ../../scripts/build_fixture_pdf.py`.
    - `seed.sql` and `demo_data.py` `source_page` values now match the PDF.
  - **Migration `…100016`:** `rule_cards`/`facts.embedding_source_hash`, and `enqueue_vault_job()` now also accepts the service role. `seed.sql` ends with `pgmq.send('vault_jobs', embed_vault for PayWise)`; `seed_demo.py` calls `enqueue_vault_job` via RPC.
  - **`brandlens_worker/guides.py`** (pure):
    - Parsing: `parse_pdf` (headings = lines ≥15% larger than body text; header/footer bands skipped; NFKC folds ligatures), `parse_docx` (Title/Heading N styles) and `parse_markdown` (for URLs via trafilatura).
    - Chunking: `chunk_sections` (≤ `MAX_CHUNK_TOKENS`=700, with `[page N]` markers).
    - Schema: `RuleCardDraft`/`RuleCardDrafts`.
    - Post-processing: `clamp_pages` keeps only pages the chunk covers, recovers a code the model put in the title, strips it from the title, and normalises odd hyphens. `dedupe` (cosine > 0.92). `assign_codes`: a guide code that already exists becomes the **next version** of that code (a proposed update); otherwise it gets the next free number per prefix (TV/G/CL/VS/A/FR).
  - **`vault.py`** (pure): `rule_embed_text` (title + summary + body + examples), `fact_embed_text` (statement + value JSON), and `plan_embeddings` (rows with no embedding or a stale hash).
  - **Jobs:** `ingest_guide` (payload `{org_id, guide_id}`; status `parsing` → `drafted`/`failed` with `error`=job code; `llm_unavailable` when degraded) and `embed_vault` (payload `{org_id}`; batches of 32). Registered in `jobs/__init__.py`. `jobs/common.py` lazily builds and caches router, embedder, storage and tracer in `ctx.services`.
  - `storage.py` (supabase-py Storage via `asyncio.to_thread`). `prompts/rule_extract_v1.md`.
  - **Web CSV import:**
    - `lib/vault/csv.ts`: RFC 4180 parser plus zod row schemas; errors carry line numbers; campaign names resolve to ids; duplicate codes are rejected.
    - `POST /api/vault/import` (multipart `kind`=facts|glossary, `file`): brand admin only, all-or-nothing validation (422 with `errors[]`), upsert on `(org_id, code)` via the RLS client, then `enqueue_vault_job('embed_vault')` for facts.
  - Dev scripts: `scripts/ingest_guide_demo.py` (upload + run `ingest_guide` in-process) and `scripts/check_retrieval.py` (hero-draft `match_vault` check).
  - Tests: worker 67 (parsing `guide.pdf`, markdown/docx, chunking, fake-router extraction, clamping, dedupe, codes, embedding plan); web vitest 58 (CSV fixtures and errors); e2e `vault-import.spec.ts` (3).
- **Acceptance results (local, 2026-10-26):**
  - **Real extraction** of `guide.pdf` produced **14 draft cards**: TV-02 v2, TV-04 v2, G-07 v2, G-08, CL-03 v2, FR-01..03 (fact-accuracy rules), VS-02 v2, VS-03..05 (palette, logo, contrast), A-02 (reading grade) and A-03 (alt text). Dimensions, severities and pages were correct.
    - Coded rules become v2 *proposals* because seeded v1s exist.
    - Run-to-run variance is real. Smaller chunks (700 tokens) fixed missed rules, and the prompt now skips process notes.
    - A-01's code came back as A-02 in that run; the title-code recovery added afterwards addresses it.
  - **Embeddings:** after `make db-reset` and a running worker, `embed_vault` embedded 6 rules and 4 facts in 2 s; `null` embeddings = 0/6 and 0/4.
  - **Retrieval:** `check_retrieval.py` hero-draft top-8 = E-19, G-07, TV-02, F-048, F-112, CL-03, TV-04, A-01, with **no E-11**.
- **Stubbed / deferred:** no admin UI for drafts, approval or upload (P05). Approving a v2 must archive the old approved version first (partial unique index). The P05 approve action should do both in one RPC. No Dockerfile yet (P10 bakes `.models`).
- **Gotchas:**
  - `match_vault` merges top-k rules and top-k facts, then cuts to k overall.
  - The extraction sees `FR-` rule cards (dimension `facts`). They're about *where* facts come from; the actual values stay CSV-only (SPEC §12).
  - Glossary imports aren't embedded (they're deterministic).
- **Exact next step:** P05 (vault admin UI): guide upload → `enqueue_vault_job('ingest_guide')`, draft-card review and approve (archive the old version, then `embed_vault`), the CSV import UI on top of `/api/vault/import`, and facts/glossary/assets lists.

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
- [ ] **Update model IDs in `apps/worker/.env`** (see the P03 handoff; the configured Groq/Gemini models are retired).

## Known issues / debt

_none yet_

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
