# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P06 done → next P07
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

- **Phase / status:** P06 / done (branch `phase/P06-pipeline-1-4`, stacked on P05 → … → P00; none merged).
- **⚠ Still open for Maanit:** update the retired model IDs in `apps/worker/.env` (Open questions). P07 needs them for real.
- **What exists now (`brandlens_worker/pipeline/`, all pure):**
  - `types.py`: `Doc` (normalised `text`, `original`, `char_map`, `to_original(start, end)`), `RedactedDoc`, `Redaction`, `Rule`, `Fact`, `GlossaryTerm`, `Vault` (campaign plus approved rules, **all** org facts incl. other campaigns and expired ones, glossary, `now`), `Finding` (spans in `Doc.text`; `codes` primary-first; `cited`).
  - `ingest.py`: text/markdown as-is, HTML → text, DOCX → paragraphs, PDF/image → `NotImplementedError`. Whitespace normalisation keeps a char map. `IngestError` codes: `too_long` (>`MAX_WORDS`), `empty_version`, `missing_file`, `unsupported_format`.
  - `protect.py`: detectors for secrets (`sk-`, `AKIA`/`ASIA`, JWT, `gsk_`/`ghp_`/`xox*`, 32+ hex), email, Luhn-valid cards, Aadhaar format, PAN (holder-type check), IFSC, account numbers (after "a/c|account"), IN phones. Overlaps resolve by detector priority then length. `protect(doc)` returns the LLM-bound `⟦REDACTED:kind⟧` copy only.
  - `filters/`:
    - `terms.py`: Aho-Corasick, token boundaries, possessive/plural tolerant, longest match wins, cites the rule card with the glossary code.
    - `entities.py`: dates (Oct 18 / 18 October / 18/10 / ISO), times, %, ₹/Rs, venues (Hall X, Auditorium, Room N, online, city list).
    - `facts.py`: % and money matched by nearby keywords (derived from value keys such as `exit_load_pct` → "exit load"); event date, time and venue checked against the referenced in-scope event. Cross-campaign matches are **bleed**. Adjacent conflicting entities cluster into one span with a deterministic rewrite. Expired in-scope facts give a warning. `mentioned_facts()` feeds claims.
    - `claims.py`: lexicon in market-linked context, phrase-extended span, missing `required_disclaimer` **merged** into an overlapping CL finding (`rule_id` + `fact_id`, historical rewrite + disclaimer), otherwise its own blocker.
    - `tone.py`: phrases quoted in tone-rule bodies are banned (warning); ≥2 "!" and density >1/40 words, or caps >15%, give a suggestion.
    - `access.py`: FK grade only when ≥60 words; vague link text and bare URLs → `wcag_ref 2.4.4` warning.
    - `base.py`: `cap_severity` (applies `DIMENSION_MAX_SEVERITY`) and `pick_rule`.
    - `run_filters` drops anything uncited.
  - `retrieve.py` (queries = whole draft + ≤24 sentences; merge by max similarity), `routing.py` (§10 `route()`, `has_open_blockers()`), `run.py` (`run_stages_1_to_4(version, vault, embed=, match_vault=, topk=)` records per-stage timings; no LLM parameter).
  - **Job `review_version`** (registered; default for `review_jobs`):
    1. Loads version + content + campaign + vault, then runs stages 1–4.
    2. Persists findings idempotently per run, with spans and quotes in the **original** text and an "Also cites: …" footer for extra codes.
    3. Sets the run to `done` with `retrieved` and `timings` (+ `total`).
    4. Calls `transition_content_system`: `needs_revision` on open blockers, else `in_review` with §10 route and risk. `IngestError` maps to `JobError(code)`.
  - `scripts/sql/hero_review.sql`: creates the hero draft as the creator and submits it via `enqueue_review()`.
- **Acceptance (local, 2026-10-26):**
  - Hero run: `done` in **95 ms** (timings `ingest 0, protect 0, filters 1, retrieve 27, total 33` ms), content → `needs_revision`.
  - Exactly 4 findings: G-07 warning "Paywise app"; F-048 blocker "0% exit load"; CL-03+F-112 blocker "lock in 14.2% assured annual returns"; E-19 blocker "Oct 18 at Hall B, Chandigarh" (explanation cites E-11 / Navratri).
  - 5 clean drafts → 0 findings. Unit tests monkeypatch `LLMRouter.generate` to raise, and stages 1–4 pass.
- **Tests:** worker 99 (pipeline 32 new).
- **Gotchas:**
  - **Typing `\u` + hex in tool input gets turned into the literal character.** Write escapes via `chr(92)` if you need them in files.
  - Ruff now ignores RUF001–003 (typographic characters are intentional here).
  - A data-modifying CTE's new row isn't visible to RLS helper functions in the same statement, so insert content and version in separate statements.
- **Exact next step:** P07. Stage 5 (one LLM call with `prompts/review_v1.md`, intent, retrieved snippets, `<already_found>`, redacted draft) and stage 6 (citation gate per SPEC §8, blocker confirmation sample, confidence, intent verification §9, degraded mode). Plug them into `review_version` between retrieve and persist.

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
