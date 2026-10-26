# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P03 done → next P04
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | done | M (Claude) | phase/P01-schema | 2026-10-26 |
| P02 | Web shell, auth, demo switcher | J | done | M (Claude, /complete) | phase/P02-web-shell | 2026-10-26 |
| P03 | Worker core | M | done | M (Claude) | phase/P03-worker-core | 2026-10-26 |
| P04 | Vault ingestion & PayWise kit | M | in-progress | M (Claude) | phase/P04-vault-ingestion | |
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

- **Phase / status:** P03 / done (branch `phase/P03-worker-core`, stacked on P02 → P01 → P00; none merged).
- **⚠ Action for Maanit: update `apps/worker/.env` model IDs.** The configured models are retired. Groq `llama-3.3-70b-versatile` and `meta-llama/llama-4-scout-…` return 404. Gemini `gemini-2.5-flash` says "no longer available to new users". These were verified working on 2026-10-26 and used for the acceptance runs via process overrides:
  `GROQ_MODEL_TEXT=openai/gpt-oss-120b` · `GROQ_MODEL_VISION=qwen/qwen3.8-27b` (accepts images) · `GEMINI_MODEL_TEXT=gemini-3.5-flash` · `GEMINI_MODEL_VISION=gemini-3.5-flash`.
- **What exists now (worker):**
  - `logs.py`: JSON logs to stdout, with `extra={}` fields at top level. httpx/httpcore are quieted.
  - `db.py`: `create_pool()` (async psycopg pool, autocommit, dict rows, `prepare_threshold=None` for poolers), plus `get_run_status`, `mark_run_running`, `fail_run` (marks failed and `transition_content_system(…,'draft', reason)` if the content is still `ai_check`) and `update_run_timings`.
  - `queue.py`: `PgmqBackend` (`read_with_poll(q, vt=120, 1, 5)`, `delete`, `archive`), `process_message()`, `consume()` and `Registry`.
    - Job name = `payload.type`, else `payload.job` (vault jobs), else `review_version` on `review_jobs`.
    - It skips runs already `done` (deletes the message), archives poison messages after 3 reads, and on a `JobError(code)` or crash marks the run failed and archives.
    - Read errors back off up to 30 s.
  - `jobs/__init__.py`: `build_registry()` with a `noop` job. P06/P07 add `review_version`; P04 adds `ingest_guide`/`embed_vault`.
  - `main.py`: lifespan opens the pool, builds a `Tracer`, and starts consumers for `PGMQ_QUEUE` and `config.VAULT_QUEUE`. Graceful stop waits up to 15 s (verified). `create_app(settings, run_queue=False)` for tests. `POST /dev/llm-smoke[?provider=groq|gemini]` exists only when `ENV` ∈ {development, dev, local}.
  - `llm/`:
    - `base.py`: `Meta`, `Image`, `LLMProvider` Protocol, errors `RateLimited`/`TransientError` (retryable) and `ModelUnavailable`/`InvalidOutput`/`ProviderError` (→ fallback), `DegradedError`. `BaseProvider.generate_structured` validates with Pydantic and retries once with the validation errors (never the raw output) appended. `extract_json` strips fences.
    - `groq_provider.py`: json_schema mode, auto-falling back per model to json_object + schema in the system prompt.
    - `gemini_provider.py`: `response_json_schema`, falling back to JSON mode on schema 400s. Reads `RetryInfo.retryDelay`.
    - `router.py`: `LLMRouter.generate(system, user, schema, *, prompt_version, vision_images, temperature)` gives tenacity 3 attempts per provider (1 s, 2 s backoff, or `Retry-After`, capped at 20 s), then the next provider, then `DegradedError`. `build_router(settings)`.
    - `cache.py`: `LLMCache` (sha256 of provider/model/prompt_version/payload) at `apps/worker/eval/.cache/`. Off unless `enabled` (defaults to `config.LLM_CACHE`).
  - `embeddings.py`: `Embedder(model, cache_dir).embed(texts)` returns (n, 384) L2-normalised. Also `cosine`, `normalise` and `to_pgvector`. Lazy fastembed singleton. `make models` downloads into `apps/worker/.models` (git-ignored); done on this machine.
  - `tracing.py`: `Tracer.from_settings()` (Langfuse v5, `base_url=LANGFUSE_HOST`), `trace_run(run_id)` context manager, `generation(...)` (input = metadata only), `current_trace_id()`, `flush()` and `shutdown()`. Everything no-ops on error, and it's disabled when `ENV=test`.
  - `prompts/__init__.py`: `load_prompt(name)` returns `(text, version)` for the latest `name_vN.md`. It validates that the `PROMPT_VERSION: name@N` header matches the filename. `prompts/smoke_v1.md`.
  - Tests (55 + 0 skipped now that the model is downloaded; all offline): router fallback, retries, Retry-After, degraded, validation retry, cache, queue (success, failure, poison, idempotent skip, loop, read errors), prompts, tracer no-op, embeddings.
- **Verified live (2026-10-26):**
  - `noop` via `select pgmq.send('review_jobs','{"type":"noop"}')` was consumed and deleted about 60 ms later.
  - `/dev/llm-smoke` returned valid structured output from Groq (`openai/gpt-oss-120b`, 1.6 s) and Gemini (`gemini-3.5-flash` → served `gemini-3.6-flash`, 3.7 s).
  - Both traces (span + generation) were confirmed in Langfuse Cloud via its API.
- **How to run locally:** `make db-start`, then `make dev-local` (web + worker against local Supabase via `scripts/local-supabase-env.sh`). Add the model overrides above until `.env` is updated.
- **Gotchas:**
  - Groq vision needs a multimodal model; `gpt-oss-120b` rejects image content.
  - Groq's `gpt-oss` supports json_schema mode; other models fall back automatically.
  - `LANGFUSE_BASE_URL` in `.env` equals `LANGFUSE_HOST`; we pass `base_url=` explicitly so either works.
- **Exact next step:** P04 (brand vault ingestion + PayWise kit): fixtures, guide → rule-card extraction prompt, `embed_vault` job filling `rule_cards.embedding`/`facts.embedding`.

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
