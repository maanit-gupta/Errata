# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P16 (partial, waiting on team items). All work is on `main`, including the U0–U2 Terminal Noir UI (restored 2026-10-27, DESIGN.md §13)
**Build window:** Day 1 = `2026-10-20`. Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | done | M (Claude) | phase/P01-schema | 2026-10-26 |
| P02 | Web shell, auth, demo switcher | J | done | M (Claude, /complete) | phase/P02-web-shell | 2026-10-26; tasks 1–2 (tokens/restyle) moved to U0; UI per DESIGN §6.1 on ui/P02 (shelved, not on main) |
| P03 | Worker core | M | done | M (Claude) | phase/P03-worker-core | 2026-10-26 |
| P04 | Vault ingestion & PayWise kit | M | done | M (Claude) | phase/P04-vault-ingestion | 2026-10-26 |
| P05 | Vault admin UI | J | done | M (Claude, /complete) | phase/P05-vault-ui | 2026-10-26; Terminal Noir UI per DESIGN §6.6 on ui/P05 (shelved, not on main) |
| P06 | Pipeline stages 1–4 | M | done | M (Claude) | phase/P06-pipeline-1-4 | 2026-10-26 |
| P07 | Stages 5–6: LLM, gate, intent | M | done | M (Claude) | phase/P07-llm-gate | 2026-10-26 |
| P08 | Editor & findings UI | J | done | M (Claude, /complete) | phase/P08-editor-findings | 2026-10-26; Terminal Noir UI per DESIGN §6.2–6.3 on ui/P08 (shelved, not on main) |
| P09 | Review workflow & notifications | J+M | done | M (Claude, /complete) | phase/P09-review-workflow | 2026-10-26; Terminal Noir UI per DESIGN §6.4–6.5, §6.8–6.9 on ui/P09 (shelved, not on main) |
| P10 | Deploy & core-loop E2E 🎯 D7 | Both | done | M (Claude) | phase/P10-deploy → main | 2026-10-26; prod e2e 3/3 green |
| P11 | Image checks | M | done | M (Claude) | phase/P11-image-checks | 2026-10-26; eval 9/9 logos, 20/20 contrast |
| P12 | PDF decks & overlays | M+J | done | M (Claude, /complete) | phase/P12-pdf-decks | 2026-10-26; deck 9/9, 40 pages 7.0 s / 484 MB in 512 MB container; merged 2026-10-27; overlay UI per DESIGN §6.11 on ui/P12 (shelved) |
| P13 | GCS & insights 🎯 D11 | J+M | done | M (Claude, /complete) | phase/P13-gcs-insights | 2026-10-27; stacked on P12; tag `v0.11-feature-complete` pushed; merged to main 2026-10-27; insights UI per DESIGN §6.7 on ui/P13 (shelved) |
| P14 | Golden set & eval gate | M | done | M (Claude, /complete) | main | 2026-10-27; eval PASS (0 degraded, all dims ≥ 0.85, blocker recall 1.00); broken-prompt gate shown locally |
| P15 | Hardening | Both | done | M (Claude, /complete) | main | 2026-10-27; SECURITY.md, rate limit, CSP, injection fence, router cool-down, load + restart tests; 2 migrations local only |
| P16 | Docs & submission 🎯 D14 | J | partial | M (Claude, /complete) | main | 2026-10-27; README, DEMO.md, reset_demo.sh, usability templates done; waiting on team: usability sessions, contributions, cloud migrations, repo public, tag |
| U0 | Design-system foundation (DESIGN.md §12) | J | done | M (Claude, /complete-ui) | main | 2026-10-27; built on ui/* branches, reverted, then restored on main with the U2 follow-ups closed (DESIGN.md §13) |
| U1 | Public landing + /ai-use (DESIGN.md §8) | J | done | M (Claude, /complete-ui) | main | 2026-10-27; landing + /ai-use public |
| U2 | UI polish and audit (DESIGN.md §12) | J | done | M (Claude, /complete-ui) | main | 2026-10-27; axe 0 serious/critical on 19 routes × 2 themes |
| R0 | UI redesign study (`docs/ui-redesign/STUDY.md`) | J | done | J (Claude) | UI/UX_jagpreet | 2026-10-28; read-only study |
| R1 | Redesign foundation: DESIGN.md, tokens, fonts, lint | J | done | J (Claude) | UI/UX_jagpreet | 2026-10-28; DB-dependent gates not run here (local Supabase unavailable, see Handoff) |
| R2–R6 | Primitives, illustrations, shell, landing, sign-in | J | partial | J (Claude) | UI/UX_jagpreet | 2026-10-28; first pass done; 21st.dev ports not yet; signed-in routes unverified here |
| R7–R10 | Feature screens (drafts, review, vault, insights, audit, settings) | J | partial | J (Claude) | UI/UX_jagpreet | 2026-10-28; restyled via shared components only |

## Handoff (latest — overwrite each phase)

- **UI redesign (branch `UI/UX_jagpreet`, 2026-10-28; not on `main`, not pushed):** R0 study and R1 foundation are done. `docs/DESIGN.md` now describes the flat, outlined, light-first system (ink + yellow highlight, grey/pink bands, DM Sans/DM Mono, original inline-SVG illustrations). Tokens are one `light-dark()` block in `apps/web/app/globals.css` mirrored by `lib/design/tokens.ts`; the contrast test asserts 55 pairs per theme. Old screens pick up the new tokens; components are rebuilt from R2 (`docs/ui-redesign/STUDY.md` §7, R2–R11).
  - **Gates not run in R1:** the local Supabase stack couldn't start on this machine (the image pull filled the disk, then Docker Desktop stopped responding), and there is no `apps/web/.env.local` here. So pgTAP, `ui.spec` signed-in routes, `keyboard.spec` sign-in tests, `a11y.spec` and the functional specs were not run. What ran: ESLint, Prettier, `tsc`, Vitest (incl. the token test), worker lint and pytest, and `ui.spec` axe on `/`, `/ai-use`, `/login`, `/dev/kitchen-sink` in both themes plus the kitchen-sink reduced-motion check, with the app on placeholder env and no DB.
  - **After R1 (same day, owner: "replicate the site"):** first pass of R2–R6 plus a feature-panel pass is committed. Public pages (`/`, `/ai-use`, `/login`), the kitchen sink and a new dev-only `/dev/shell` preview pass axe in both themes and the 25-stop focus-outline check; signed-in routes have not been rendered here.
  - **Local stack fixed (2026-10-28):** Docker Desktop's containerd image store held corrupted partial downloads (the disk filled mid-pull), so Docker was switched to the classic image store (`UseContainerdSnapshotter: false`; other projects' images are hidden, not deleted, until it's switched back). `make db-start lite=1`, `make seed-assets-local`, `make dev-local` now run on this machine with no `.env` files (placeholder LLM keys → degraded reviews). Green against it: `auth`, `keyboard`, `ui` (all routes × 2 themes), `a11y`, `drafts`, `review`, `vault`, `vault-import`, `core-loop` (F02–F05). Two first-run timeouts (cold compile, worker model download) passed on re-run.
  - **Exact next step (was):** fix Docker and free disk; `make db-start && make db-reset && make seed-assets-local`; run `make check`, the full `ui.spec`, `keyboard.spec`, `a11y.spec`, `auth.spec`, `drafts.spec`, `review.spec`, `vault*.spec`, `insights.spec` and `core-loop.spec`; fix what they find; then R7–R10 page layouts and copy trims (STUDY.md §6).
- **UI (2026-10-27, user request "complete the design.md"):** `main` runs the full Terminal Noir UI (DESIGN.md). It was re-applied from `ui/U2` as a 3-way patch on top of P15, so the P15 limits, CSP, signed-URL TTL and loading/error states are kept. The U2 follow-ups are closed (DESIGN.md §13): sticky DecisionBar with per-action dialogs, version switcher (`?v=N` read-only), "View as table" toggle, contrast/ΔE swatches, palette empty state.
  - Gates: `make check` green; axe 38/38 (19 routes × 2 themes), keyboard and a11y specs green; core-loop, review and drafts e2e green on the local stack. E2E changes: sign-off and request-changes now go through dialogs ("Confirm sign-off", "Send request"); the P15 keyboard test uses the new nav labels ("Rule cards").
  - **Deployed 2026-10-27:** Vercel production (https://brandlens-app.vercel.app) and Render worker (`b012ef6`, `/healthz` ok) both auto-deployed from `main`. Production UI gates: `ui.spec` + `keyboard.spec` + `a11y.spec` 49 passed, 1 skipped (dev-only kitchen sink). Real data surfaced three fixes, now shipped: tab-panel focus ring, toast focus ring, version-switcher accessible name.
  - **Local Storage is broken after `make check`'s db reset:** every upload returns 500 (Postgres 42P10) from storage-api v1.72.1, so `make seed-assets-local`, `image-check.spec` and `pdf-check.spec` fail locally. Cloud Storage is unaffected. Try `supabase stop && supabase start` (or upgrade the CLI) before running those specs locally.
- **Workflow (user rule 2026-10-27):** work and commit directly on `main`. No phase/UI branches and no worktrees.
- **Phase / status:** P16 / **partial** (2026-10-27). Everything Claude can do is done; the rest needs the team (below). P14 and P15 are done (see their rows; P15 details are in `docs/SECURITY.md` and README "Security and reliability").
- **What P16 added:**
  - `README.md` restructured: pitch and problem, Mermaid architecture and key decisions, Results (golden set, images, PDFs, usability pending), Changes since Round 1 (full table, including the Render/Singapore hosting change), models/services/data/templates/libraries with licences, limitations and roadmap, team and contributions, AI assistance through P16.
  - `docs/DEMO.md`: a 3:40 script over F01–F06 with exact clicks and lines to say, a pre-session checklist, and a fallback table (LLM rate-limited → the four hero findings are all deterministic; worker asleep; insights not reset).
  - `scripts/reset_demo.sh <SUPABASE_URL> --yes` + `scripts/sql/reset_demo.sql`: clears every PayWise content, rolls rule cards back to v1 (undoing F06's TV-04 v2), sets example suggestions back to pending, re-seeds, re-simulates. The SQL was tested locally (157 contents → 0; TV-04 v2 → v1 approved). **Not run against cloud.**
  - `docs/usability/`: consent note, moderator script (A/B manual vs BrandLens with two captions that each carry the same four deterministic issues, verified in-process; tasks T1–T4), SUS form with scoring, results tables.
  - `docs/SECURITY.md`: git history secret scan (clean; the one webhook match is a test fixture).
- **Waiting on the team (P16 acceptance):**
  1. ~~Cloud migrations `…100020`/`…100021`~~: confirmed applied on cloud (Supabase migration list, 2026-10-27).
  2. **Usability sessions** (Jagpreet): run `docs/usability/tasks.md`, fill in `results.md`, then replace "Results pending" in README → Results.
  3. **Contributions** (Jagpreet): add specifics to README → Team and contributions. Git shows every commit from `maanit-gupta`.
  4. **Make the repo public** (still PRIVATE; needs the user's go-ahead). `gitleaks git` is clean (2026-10-27; two fake test strings ignored in `.gitleaksignore`). Tag `v1.0-round2` is pushed (at `1e4a334`; move it if later commits must be included). Confirm the live link in README.
  5. Optional: add `GROQ_API_KEY`/`GEMINI_API_KEY` as GitHub Actions secrets so `eval.yml` can run live on prompt changes.
  6. Before judging: `scripts/reset_demo.sh`, then a recorded dry run per `docs/DEMO.md`.
- **Gotchas:** `make check` resets the local DB (`make test-db`). Free-tier LLM quotas run out after a full eval plus a burst; keep load tests off the cloud stack on demo day.
- **Final check (2026-10-27, /complete):** `make check` green (pytest, Vitest, 106 pgTAP).
- **Exact next step:** the team items above (usability results, contributions, make the repo public, demo reset and dry run).

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
| 2026-10-26 | P10 | `main` fast-forwarded to `phase/P10-deploy` (P00–P10 linear stack) without PR review; Render + Vercel deploy from `main` (user decision) | GitHub repo was empty; deploys need a stable production branch. Jagpreet can review after the fact |
| 2026-10-26 | P10 | Render service created via MCP with non-secret env only; secrets pasted by the user in the dashboard; Vercel secrets piped through the CLI | CLAUDE.md: never read secret values |
| 2026-10-26 | P10 | Langfuse Cloud host = US region (`us.cloud.langfuse.com`) on Render (user answer) | Matches the user's Langfuse project |
| 2026-10-26 | P10 | Non-secret Render env is restored/managed via the Render MCP in merge mode, never `replace` | A dashboard save wiped the env once; merge never touches user-pasted secrets |
| 2026-10-26 | P11 | Added rule cards **VS-01** (palette), **VS-03** (logo), **A-02** (text in images) to guide, seed and demo_data | Deterministic image findings must cite a rule (invariant 1); the guide had palette/logo/contrast text without codes |
| 2026-10-26 | P11 | Logo and palette live in `assets` (2 logos + palette); `seed_demo.py` uploads logo files; `make seed-assets-local` for local | Worker reads the org's own assets; no fixtures baked into the image |
| 2026-10-26 | P11 | OCR = 3 Tesseract passes (plain, inverted dark regions, binarised page), words < 6 px dropped | Single pass missed buttons/inverted panels and faint fine print; CLAHE produced junk on photos |
| 2026-10-26 | P11 | ORB first; `matchTemplate` (half-res search + full-res refine) only when ORB fails, plus correlation at the ORB box | Full multi-scale TM cost 2.3 s/image; ORB 0.04–0.14 s |
| 2026-10-26 | P11 | Contrast glyph colour = median of RGB-furthest pixels from ring background | Exact on PNG (20/20 random pairs) vs luma (max Δ 0.06); JPEG stays an estimate and the finding says so |
| 2026-10-26 | P11 | Palette check clusters only flat pixels (5×5 std < 4) | Photos and gradients aren't "fills"; VS-02 covers imagery |
| 2026-10-26 | P11 | One vision call per image (OCR text + alt text + image); image-target findings gated on the warmth pre-filter and barred for logo/palette rules; skipped when nothing to judge | Invariants 3 and 4; the LLM never supplies coordinates |
| 2026-10-26 | P11 | Thresholds: `CLEAR_SPACE_VARIANCE_MAX=150`, `WARMTH_COOL_B=-4`, `LARGE_TEXT_PX=24`, `TINY_TEXT_PX=12`, `FAINT_TEXT_RATIO=1.5`, `VISION_MAX_SIDE=1024`; `LOGO_MIN_GOOD_MATCHES` stays 12 | Tuned on the creatives (clean ring 0 vs cramped 7311; b* +5..+7 vs −16.7); see eval/vision_report.md |
| 2026-10-26 | P11 | Image findings resolve via "Mark fixed in the image" (status `edited`, any severity); the next upload is re-checked | Fixes happen in the design file; nothing is one-click-accepted from an AI rewrite (invariant 6) |
| 2026-10-26 | P11 | Pixel thresholds are in raw image pixels (no normalisation) | The guide states pixel minimums; fixtures are 1080 px |
| 2026-10-26 | P11 | `main` fast-forwarded to P11 (1ba6481) without PR review (user decision) | Same deploy-from-main flow as P10; Jagpreet can review after the fact |
| 2026-10-26 | P11 | mypy treats `cv2`/`skimage` as Any | Bundled stubs reject valid calls (e.g. `ORB_create`, `kmeans` on float32) |
| 2026-10-26 | P11 | Cloud seeded with the P11 kit (user approved) | Cloud image reviews need VS-01/VS-03/A-02, assets and logo files |
| 2026-10-26 | P11 | Override sonner's light rich-colour toast text in `globals.css` (success/error/info/warning ≥ 4.8:1) | Defaults fail WCAG 1.4.3 (3.07–4.36); the app must pass its own checks |
| 2026-10-26 | P12 | PDF boxes and thumbnails share one pixel space: pages rendered with the long side ≤ 1400 px (`PDF_RENDER_MAX_SIDE`, zoom ≤ 2); `review_runs.pages` manifest (new migration) | The UI reuses `ImageFindings` per page with no scaling metadata |
| 2026-10-26 | P12 | Word-level segments from PyMuPDF `rawdict` char boxes, extracted with no clip | Span-level boxes covered whole lines; text placed off the page must be caught as hidden |
| 2026-10-26 | P12 | Hidden text: one finding per run, claims blocker (merged with the CL finding) or access A-02 (+1.4.3 if faint); redacted from the LLM copy as `hidden_text`; other deterministic findings inside it are folded in | SPEC §6 stage 2; the fix is "remove it"; possible prompt injection never reaches the model |
| 2026-10-26 | P12 | LLM: one call per **page chunk** (whole pages packed to `PDF_CHUNK_WORDS`=700), each gated against its own sub-Doc | PHASES P12 exception; packing keeps a 4-page deck to 1 call and avoids Groq 429s on 40 pages |
| 2026-10-26 | P12 | PDF logo search only inside image placements, with template-correlation confirmation (`detect_logo(confirm=True)`, ≥ TM_MIN_SCORE 0.72); no "missing logo" on deck pages; size compared in CSS px at 100% zoom | A bold heading gave 29 ORB inliers (corr 0.36) vs 0.95 for the real logo; whole-page template search on logo-less pages cost 30.8 s → 8.6 s per 40 pages |
| 2026-10-26 | P12 | Embedded pictures get the P11 checks via `check_image(standalone=False)` and are lifted to page-level image findings (quote = OCR text) | Claims in pictures aren't in the text layer |
| 2026-10-26 | P12 | Thresholds added: `PDF_RENDER_MAX_SIDE=1400`, `PDF_RENDER_MAX_ZOOM=2.0`, `PDF_MAX_WORDS=12000`, `PDF_HIDDEN_PT=4`, `PDF_IMAGE_MIN_PX=120`, `PDF_CHUNK_WORDS=700`, `EMBED_TOKEN_BUDGET=512` | See eval/pdf_report.md |
| 2026-10-26 | P12 | Embeddings run in length-sorted batches under 512 padded tokens (`EMBED_TOKEN_BUDGET`) | The 40-page run was OOM-killed at 512 MB: one long query padded a 25-text batch (peak 1015 MB); now 484 MB. Also protects long text drafts |
| 2026-10-26 | P12 | Latency test takes the best median of 3 rounds and skips when load/CPU > 0.5 | It measured a busy laptop, not the code (same 17–21 ms with and without the P12 change) |
| 2026-10-26 | P12 | PDF findings resolve like image findings ("Mark fixed in the PDF", then upload the corrected file); the findings list follows the selected page, with a "Show all pages" toggle; "Show on page N" pins the selection | A PDF can't be patched in place; the pin survives the mouseleave caused by scrolling |
| 2026-10-27 | P13 | GCS is computed per rule-card **version** (`rule_gcs`); "AI wrong" dismissals don't count against a rule | A revised card starts a fresh score, so the before/after of the example flow is visible; model errors aren't guideline ambiguity |
| 2026-10-27 | P13 | `flag_unclear_rules` inserts a pending placeholder `example_suggestions` row before queueing `generate_examples` | Idempotent: one generation per UNCLEAR version even though every review calls it |
| 2026-10-27 | P13 | Approved examples are appended through `revise_rule_card` (v n+1, `source: generated`), then re-embedded by `embed_vault` | Reuses the P05 archive/approve atomics and the `embedding_source_hash` re-embed path |
| 2026-10-27 | P13 | Suggestions drawer is a native `<dialog>` | Focus trap, Esc and inert background for free; axe-clean |
| 2026-10-27 | P13 | Simulated history is written as archived contents through `private.apply_transition`, with `simulated: true` audit events driving the "Illustrative data" pill | Never bypasses the state machine; the pill appears only when simulator data is in the window |
| 2026-10-27 | P13 | Activating a finding (overlay click, keyboard focus) pins it in the draft workspace | The scroll the click causes fired mouseleave on the box and cleared the highlight (flaky image e2e under load) |
| 2026-10-27 | UI | Terminal Noir design system adopted (`docs/DESIGN.md`); supersedes Round 1 light palette and serif | Team design decision; DESIGN.md §0 |
| 2026-10-27 | U0 | Theme is a `bl_theme` cookie (`dark`/`light`/`system`) read by the root layout into `<html data-theme>`; no choice = OS preference, dark by default | No flash of the wrong theme; works without JS |
| 2026-10-27 | U0 | DESIGN tokens are the source; shadcn/legacy names (`background`, `primary`, `muted-foreground`…) alias them in `@theme` | Restyles every existing screen at once; feature phases migrate class names as they touch each screen |
| 2026-10-27 | U0 | Tailwind names: `canvas/elevated/hover/code`, `line/line-strong/control`, `fg/fg-muted/fg-faint`, `accent*`, severity names as in DESIGN | `text-text`, `bg-bg` would be unreadable; mapping is 1:1 with §2 tokens |
| 2026-10-27 | U0 | Hex literals in `.tsx` are an ESLint error (`no-restricted-syntax`); the PayWise palette default in asset-forms is the one disabled line (data, not UI) | DESIGN §10 |
| 2026-10-27 | U0 | IdBadge is a Base UI Popover trigger fed by server-loaded `CitationSource`; vault rows use the static `IdCode` | No client fetching or RLS surprises; vault rows already are the source |
| 2026-10-27 | U0 | Disabled actions use Base UI `focusableWhenDisabled` + `aria-describedby` reason; tooltips (`Hint`) are supplementary only | Disabled buttons aren't focusable, so a tooltip alone hides the reason from keyboard and AT users |
| 2026-10-27 | U0 | App shell scrolls the document (sticky sidebar and top bar), not an inner `<main>` | An overflow `<main>` failed axe `scrollable-region-focusable` |
| 2026-10-27 | U0 | Role chip is visible under the org name in the sidebar (`data-testid=role-pill`); the demo switcher is a strip popover of submit buttons | Tests and users need the role at a glance; buttons avoid change-on-select (WCAG 3.2.2) |
| 2026-10-27 | U0 | Demo switch toast uses a short-lived `bl_flash` cookie set by `signInAsDemo` | Survives the server redirect without polluting the URL |
| 2026-10-27 | U0 | UI gate = `e2e/ui.spec.ts`: axe (serious/critical) per route × theme; `SCREENS=<phase>` writes `docs/screens/<phase>/` | One reusable gate for every UI phase |
| 2026-10-27 | U0 | `/`, `/ai-use`, `/dev/*` are open paths in the proxy; `/` honours `bl_skip_landing` | Public landing (U1) and the kitchen sink without sign-in |
| 2026-10-27 | U1 | `/` is the public landing under `app/(marketing)`; the old redirect page is gone. Signed-in visitors get the skip toast; `bl_skip_landing=1` redirects `/` → `/drafts` in the proxy | DESIGN §8 |
| 2026-10-27 | U1 | "What we heard" attributes by role and city only, paraphrasing plan p.6/p.23; no names until consent is confirmed | DESIGN §8.8; logged as an open question |
| 2026-10-27 | U1 | Guarantees band and the AI-use Quality table read `apps/worker/eval/report.json` at request time; absent → `TARGET` / "not committed yet" | P14's report isn't committed on this branch; nothing invented |
| 2026-10-27 | U1 | Carousel has an explicit Pause/Play button besides hover/focus pause, and doesn't rotate under reduced motion | WCAG 2.2.2 needs a pause mechanism for >5s auto-rotation |
| 2026-10-27 | U1 | `useReducedMotion` is our own `useSyncExternalStore` hook (server snapshot false), not motion's | motion's hook read matchMedia during hydration and caused a mismatch |
| 2026-10-27 | U1 | Services list corrected: Supabase region Singapore, worker host Render, Langfuse receives ids/counts only (not prompts); one shared `components/ai-use/disclosure.tsx` for `/ai-use` and `/settings/ai-use` | Matches P03/P07/P10 decisions; one source of truth |
| 2026-10-27 | P02-UI | Demo role cards: the submit button's name is just the role (card made clickable with a stretched `::after`); the capability line is sibling text | Keeps `getByRole('button', {name:'Creator'})` stable and avoids axe label-content-name-mismatch |
| 2026-10-27 | P02-UI | Wrong-credential copy is "Email or password is incorrect." | DESIGN §6.1; doesn't hint which field was wrong |
| 2026-10-27 | P05-UI | Rule card and fact editors are a 560px `Drawer` (Base UI Dialog); rule drawer stays URL-driven (`&card=`) | DESIGN §6.6; keeps back-button and deep links |
| 2026-10-27 | P05-UI | `Never send to AI` toggle on rule cards writes `rule_cards.never_send` directly via the admin RLS policy (`setRuleNeverSend`) | `revise_rule_card` has no never_send arg; toggling isn't a content change, so no new version |
| 2026-10-27 | P05-UI | Saving a rule card keeps each example's `source` (`guide`/`generated`) | It reset every example to `guide`, erasing the P13 GENERATED tag |
| 2026-10-27 | P05-UI | CSV import is a 3-step dialog (Upload → Preview → Import) but stays all-or-nothing; invalid rows block the import and can be downloaded as an error report | DESIGN says "only valid rows import"; the P04 all-or-nothing decision wins on behaviour (logged deviation) |
| 2026-10-27 | P05-UI | Bulk bar label is `Approve n rule cards` (selected, or all drafts when none selected) | Storyboard F01 copy; one button instead of two |
| 2026-10-27 | P08-UI | New drafts start at `/drafts/new` (title, channel, campaign → Create draft); `/drafts` shows onboarding or the table | The top bar's `+ New draft` needs a route; the list page stays a list (DESIGN §6.2) |
| 2026-10-27 | P08-UI | Workspace = intent (280) · editor · findings (400) at ≥xl; intent spans the top at lg; Submit sits in the header, Resubmit in a sticky bar under the findings when `needs_revision` | DESIGN §6.3; never two buttons with the same name on screen |
| 2026-10-27 | P08-UI | Submit is disabled (focusable, with the reason via `aria-describedby`) until intent is complete and the draft is ≤ 2,000 words | DESIGN §6.3 "Submit disabled until intent is complete"; WordCounter mirrors worker `MAX_WORDS` in `lib/drafts/limits.ts` |
| 2026-10-27 | P08-UI | Dismiss is a dialog of radio cards with per-reason help ("tells your brand team the rule may be unclear") | DESIGN §6.3 |
| 2026-10-27 | P08-UI | Citation popovers get rule body/version/source page/never-send from the draft page (agencies: `rule_cards_public` summary, marked SUMMARY VIEW); vault links only for brand admins | Server-loaded, RLS-scoped (U0 decision) |
| 2026-10-27 | P08-UI | IntentCheckTag shows a bare `✓ intent verified` on surviving LLM rewrites; the cosine isn't persisted per finding | No column for it; dropped rewrites never reach the UI (P07) |
| 2026-10-27 | P08-UI | No version switcher on the draft page yet; the version label shows `vN` and the review page's DiffView covers history | Scope; logged for U2 |
| 2026-10-27 | P08-UI | `j/k/a/e/x` act on finding cards via the `bl-finding-key` event from the global shortcut handler | DESIGN §7.4; single-key shortcuts can be switched off (WCAG 2.1.4) |
| 2026-10-27 | P08-UI | App-wide `(app)/loading.tsx` (Spinner) and `(app)/error.tsx` (ErrorPanel with digest) | DESIGN §11 loading/error states for every route |
| 2026-10-27 | P08-UI | E2E: specs wait for `networkidle` after `goto('/drafts/new')`; axe tests emulate reduced motion | Typing before hydration was reset by the Base UI input; axe flagged mid-fade frames |
| 2026-10-27 | P09-UI | Review queue tabs: admin `For me · Legal · Accessibility · Brand · All`, manager `For me · All`, specialist `For me`; the routing reason is a mono line under each title instead of an expandable row | DESIGN §6.4; always visible beats hover-only for keyboard users |
| 2026-10-27 | P09-UI | Review page = read-only render (left, sticky) + Decision panel and `Findings · Diff · Comments · Audit` tabs (right); findings reuse FindingCard read-only | DESIGN §6.5 |
| 2026-10-27 | P09-UI | DecisionBar stays a panel above the tabs, not a sticky bottom bar with per-action dialogs | Its override/sign-off/request-changes fields are e2e-covered; moving them into dialogs is a P15/U2 follow-up (deviation) |
| 2026-10-27 | P09-UI | New global `/audit` (manager, specialist, admin): filters by content/actor/event type, IST times, CSV export, links to the review page | DESIGN §6.8; route was missing |
| 2026-10-27 | P09-UI | Settings: Profile, Appearance (theme radio cards, landing-page toggle undoing `bl_skip_landing`, single-key shortcut toggle), Notifications (Discord status + admin "Send test message", Resend status), Organisation members (admin), Demo reset as disabled button with the script name | DESIGN §6.9; webhook URL never shown |
| 2026-10-27 | P09-UI | StateBadge keeps sentence-case DOM text (`<span>{label}</span>`) and uppercases with CSS; specialist state reads `Legal/A11y/Brand review` from `route_to` | Tests and screen readers get words, not shouting; DESIGN §2.4 labels |
| 2026-10-27 | P09-UI | In-text links are underlined by default | axe `link-in-text-block` (WCAG 1.4.1) |
| 2026-10-27 | P12-UI | OverlayCanvas (image) gets zoom (− / % / + / Fit / 100%) and a `Show boxes` toggle; boxes draw in over 300ms (`overlay-draw`), instant under reduced motion | DESIGN §6.11, §4.1 |
| 2026-10-27 | P12-UI | PDFs over 40 pages are rejected in the browser before upload (counting `/Type /Page` objects) with "This PDF has N pages; the limit is 40." | DESIGN §6.11; the worker still enforces it |
| 2026-10-27 | P12-UI | Resolved findings show who resolved them (`· by Rohan`) | DESIGN §6.3 resolved line; the review e2e relies on it |
| 2026-10-27 | P12-UI | Contrast/ΔE swatches inside the card aren't rendered; the measured ratio stays in the explanation text | Findings don't persist structured colour values; adding them is a worker change (logged for U2/P15) |
| 2026-10-27 | P13-UI | KPI row uses KpiTile; chart bars `--accent-soft`, mono codes; chart is `role=img` with `accessibilityLayer={false}` next to its data table | The chart referenced removed CSS vars (`--foreground`); Recharts' focusable surface inside aria-hidden failed axe |
| 2026-10-27 | P13-UI | Chart and table are shown side by side instead of a "View as table" toggle | The table must stay visible (accessible fallback, e2e); deviation from DESIGN §6.7 |
| 2026-10-27 | P13-UI | Managers see the KPI row and top issues only; the watchlist is hidden with a one-line note | SPEC §2 footnote 5 / DESIGN §6.7 |
| 2026-10-27 | P13-UI | IllustrativeDataPill keeps DOM text "Illustrative data" (CSS uppercases it) | Same rule as StateBadge; e2e matches the words |
| 2026-10-27 | U2 | `e2e/keyboard.spec.ts`: skip link first, visible focus ring on 25 tab stops, ⌘K open/close, `?` sheet, `g d`, and no running animations under reduced motion | DESIGN §7.4–7.5 gate, automated |
| 2026-10-27 | U2 | PDF page-rail buttons take their name from sr-only text (`Page 3: 1 blocker, 2 warnings`), with the visible `p. 3 · 1B` aria-hidden | axe label-content-name-mismatch; e2e names unchanged |
| 2026-10-27 | U2 | DiffView shows `−`/`+` markers inside del/ins and `resolves CL-03 · F-112` lines | DESIGN §5: colour is never the only cue |
| 2026-10-27 | U2 | Open UI follow-ups (deviations): sticky DecisionBar with per-action dialogs, draft version switcher, contrast/ΔE swatches in cards, chart "View as table" toggle, palette empty-state drift, landing LCP not yet measured on Vercel | Logged here for P15; none blocks the core loop |
| 2026-10-27 | P14 | Eval runs in-process with no DB: vault from `scripts/demo_data.py` at a fixed date, real bge-small, retrieval mirrors `match_vault` | PHASES says "local DB"; in-process is the same pipeline, runs in CI without Supabase, and is deterministic |
| 2026-10-27 | P14 | A degraded row fails the eval gate | A no-LLM row measures only the deterministic stages and would inflate precision |
| 2026-10-27 | P14 | `INTENT_COSINE` 0.82 → 0.74 | Golden rewrites: 0.82 kept 10/16 good; 0.74 keeps 15/16 with 0/24 bad (highest bad 0.707) |
| 2026-10-27 | P14 | Router replays any provider's cache entry before a live call | A fallback-recorded response must replay in CI instead of calling the primary again |
| 2026-10-27 | P14 | Glossary skips URLs/emails/domains; "Rest assured" isn't CL-03; TV-02 caps needs ≥2 shouted words and ignores financial acronyms | First report's deterministic false positives (access-01/02/04, neg-assured-02, claims-03) |
| 2026-10-27 | P14 | `review@2` prompt: cite the specific TV rule; leave reading level, jargon and link text to deterministic checks | review@1 LLM FPs (TV-02 instead of TV-04; A-01 on "SIP"/"equity fund") |
| 2026-10-27 | P14 | `eval.yml` is a separate path-filtered workflow using repository secrets and repo variables for model IDs | Model IDs are in the cache key; non-worker PRs shouldn't spend quota |
| 2026-10-27 | P14 | `DIMENSION_MAX_SEVERITY` unchanged: the full run (review@2, 0 degraded) has every dimension ≥ 0.85 (facts 0.90, tone 0.90, rest 1.00) | The precision gate only demotes dimensions under 0.85 |
| 2026-10-27 | P14 | Broken-prompt gate demonstrated locally, not on a throwaway branch | Main-only rule (no branches) and the repo has no Actions secrets yet; `eval.yml` runs the same `make eval` command |
| 2026-10-27 | P15 | Submit rate limit (10/min/user) lives in `enqueue_review()` via `private.hit_rate_limit` (fixed window, `private.rate_counters`, SQLSTATE `BL429`) | Enforced for every caller, not just the server action; no extra service |
| 2026-10-27 | P15 | CSP keeps `script-src 'unsafe-inline'` (no nonces) | App Router inline bootstrap + all-dynamic pages; nonces need a per-request proxy rewrite. Everything else is locked to self + the Supabase project |
| 2026-10-27 | P15 | Uploads capped at 4 MB (was 20 MB guides/drafts, 10 MB assets); `serverActions.bodySizeLimit` 4.5 MB | Next's default action body limit is 1 MB (bigger uploads failed) and Vercel caps request bodies at 4.5 MB |
| 2026-10-27 | P15 | Signed URL TTL 3600 → 900 s, one constant (`lib/limits.ts`) | Shorter-lived links; URLs are re-minted on every server render |
| 2026-10-27 | P15 | Bucket `file_size_limit`s + MIME allow-lists on drafts/renders (migration `…100021`) | Defence in depth behind the action checks |
| 2026-10-27 | P15 | `llm_pass.fence()` neutralises our section tags inside untrusted text | A draft containing `</draft><rules>` could otherwise forge message structure |
| 2026-10-27 | P15 | 3 review consumers (`REVIEW_CONSUMERS`), image/PDF stages 1–4 share 1 slot (`HEAVY_JOB_SLOTS`), DB pool max 8 | Text jobs are LLM-bound; two 40-page decks at once would exceed 512 MB |
| 2026-10-27 | P15 | Router cool-down: a provider still 429 after retries is skipped for 60 s (or Retry-After) | Load test: every queued job waited through the same backoff before degrading (P95 ~13 min) |
| 2026-10-27 | P15 | Load test runs on the local stack, not the deployed one | 50 live reviews would spend the free-tier quota the live demo needs and write 50 drafts into the cloud demo org; `scripts/load_test.py` takes the cloud DATABASE_URL when wanted |
| 2026-10-27 | P15 | Worker image builds as the `app` user with `COPY --chown` and `UV_NO_CACHE=1` | The final `chown -R` layer duplicated the venv |
| 2026-10-27 | P15 | Recharts `accessibilityLayer={false}` on the decorative insights chart; toasts moved to top-center | axe `aria-hidden-focus` on /insights with real data; toasts covered the submit button |
| 2026-10-27 | P16 | Demo reset deletes every PayWise content and rolls rule cards back to v1, then re-seeds and re-simulates | A known clean state for live judging; F06 (approving TV-04 examples) is repeatable |
| 2026-10-27 | P16 | Usability captions use only deterministic issues | A/B results can't be skewed by LLM quota on test day |
| 2026-10-27 | P16 | Not tagged `v1.0-round2` and repo left private | Usability results and contributions are pending, and making the repo public is the user's call |
| 2026-10-27 | UI | `ui/U2` merged to `main` (fast-forward after merging `main` into it) without PR review and deployed (user request) | Same deploy-from-main flow as P10/P11; Jagpreet can review after the fact |
| 2026-10-27 | UI | Terminal Noir UI reverted on `main` (web, lockfile and CLAUDE.md restored to pre-U0); the code stays on `ui/U2` | User: production didn't match the UI they run locally; they will ask for a rebuild later |
| 2026-10-27 | all | Work directly on `main`; no phase/UI branches or worktrees (CLAUDE.md and the commands updated) | User rule: what runs on localhost from the main checkout is what ships |
| 2026-10-27 | UI | Terminal Noir UI restored on `main` (`git diff f6f4e7e d1415c5 -- apps/web` applied 3-way on top of P15; 5 conflicts resolved to the redesign, keeping P15's `SIGNED_URL_TTL_S`) and deployed (user request) | User: "complete the design.md", push to main, deploy |
| 2026-10-27 | UI | DecisionBar is a sticky panel under the review tabs; each reasoned action opens a centred `Modal` (Base UI Dialog), and Archive sits in a `⋯` menu behind a confirm. Confirm buttons have their own names ("Approve with overrides", "Confirm sign-off", "Send request") | DESIGN §6.5; distinct names keep the trigger and confirm unambiguous for AT and tests. Replaces the P09-UI panel deviation |
| 2026-10-27 | UI | Version switcher: older versions open read-only at `/review/[id]?v=N`; on an older version the decision panel shows "Decisions apply to the latest version" with a link | DESIGN §6.3/§6.5; a decision must always target the version that will ship |
| 2026-10-27 | UI | Contrast/ΔE swatches are parsed from the worker's fixed explanation strings (`lib/drafts/swatches.ts`, unit-tested), not new columns | No migration or worker change; an unmatched string just renders no swatch. Replaces the P12-UI deviation |
| 2026-10-27 | UI | "View as table" toggle; in chart view the table is `sr-only`, not removed | Screen-reader users always get the numbers (DESIGN §6.7). Replaces the P13-UI side-by-side deviation |
| 2026-10-27 | UI | Focus rings on elements that also need `outline-none` use `focus-visible:outline-solid` (or drop `outline-none`) | Tailwind v4 `outline-none` sets `--tw-outline-style: none`, which overrides a later `outline-2`; this hid the SegmentedTabs panel ring |
| 2026-10-27 | UI | Kitchen-sink reduced-motion e2e skips when the route 404s (production builds) | `/dev/kitchen-sink` is dev-only by design (§10) |
| 2026-10-27 | P16 | `.gitleaksignore` lists the two fake detector-test strings by fingerprint; gitleaks (MIT, local tool, not a project dependency) used for the pre-public scan | Keeps a future `gitleaks git` run clean without weakening rules |
| 2026-10-28 | R0 | UI redesign runs on branch `UI/UX_jagpreet` (owner override of the main-only rule for this task); nothing merges to `main` until the owner says so; no pushes by Claude | Production deploys from `main`; the redesign must not reach the live demo half-done |
| 2026-10-28 | R1 | Visual direction: flat, friendly, light-first with 2px ink outlines, ink primary buttons, a yellow highlight, grey/pink section bands (one angled), a black featured card and a yellow footer. Reference = the owner's chosen commercial website template; **style copied, assets not**: no illustration, logo, text or layout is reused or traced, and no template or vendor name appears in code or UI | Owner decision (replaces Terminal Noir and a short-lived, uncommitted "calm editorial, cobalt" direction from earlier the same day) |
| 2026-10-28 | R1 | Palette: ink `#000`/off-white, yellow `#F7B924` (fill only, always with black text and a 2px ink outline), grey `#EEEEEC`, pink `#FACBED`; blocker `#A31428`, warning burnt orange `#A14400` on peach, success `#137A52`; dark theme near-black `#121211` with off-white outlines and the same yellow | Owner palette; every text pair ≥ 4.5:1 and every UI boundary ≥ 3:1 in both themes (DESIGN.md §2.3) |
| 2026-10-28 | R1 | Warning is never yellow: burnt-orange text on a peach tint + `TriangleAlert` + the word Warning, never a solid fill; yellow never carries status | Owner rule; colour is never the only cue and the two must not be confused |
| 2026-10-28 | R1 | Tokens defined once as `light-dark(#light, #dark)` with `color-scheme` (light default, OS preference when no choice, `data-theme` overrides); the three duplicated light blocks are gone; contrast test parses the pairs (hex only) and asserts one row table in both themes | One source of truth; light-dark() is Baseline 2024 |
| 2026-10-28 | R1 | Fonts: DM Sans (variable) + DM Mono 400/500 via `next/font/google`, self-hosted at build; `geist` removed. Alternatives considered: Bricolage Grotesque, Figtree, Space Grotesk (DESIGN.md §4) | Friendly geometric, legible at UI sizes, mono from the same family; CSP allows only `font-src 'self'` |
| 2026-10-28 | R1 | Monospace only for IDs, numbers and code; `mono-label` is now a sans label (legacy alias of the new `label` utility) so existing screens switch without component edits | Owner decision |
| 2026-10-28 | R1 | Radii: 4px buttons/inputs/chips, 8px popovers/menus/toasts, 16px cards/panels/dialogs; no shadows (`--shadow-pop: none`); legacy grid, glow, gradient and pixel hooks neutralised in CSS until their components go | DESIGN.md §3 |
| 2026-10-28 | R1 | ESLint now also bans Tailwind palette classes (`bg-zinc-900`, `text-white`, `bg-black/50`…) and yellow as text (`text-highlight`) in `.tsx`; the 8 dialog scrims moved to a new `--overlay` token (`bg-overlay`) | Tokens only; yellow on white is 1.76:1 |
| 2026-10-28 | R1 | Skeletons allowed where the layout is known (tables, cards, KPI tiles); spinners for actions | Owner decision; replaces the old "no skeletons" rule |
| 2026-10-28 | R1 | Illustrations are original inline-SVG components (`components/illustrations/`, R3) coloured only by `--illo-*` tokens; no people/characters in the first set; new text wordmark + lens mark replaces the pixel lens | Copy the style, not the assets |
| 2026-10-28 | R1 | Landing (R5) is short: hero, 3 illustrated steps, context-bleed example, trust band, featured demo card, yellow footer; "What we heard" and the stats bands are cut | Owner decision |
| 2026-10-28 | R1 | 21st.dev components are copied in by hand from R2 and must port to Base UI + `motion` + tokens; no Magic MCP | Owner decision |
| 2026-10-28 | R1 | To remove later: sidebar tip/watchlist cards and GitHub link (R4), disabled "Reset demo data" button (R10) | Owner decision |
| 2026-10-28 | R1 | E2E specs and unit tests may be updated in the same commit as the change that breaks them, keeping assertions as strong | Owner decision |
| 2026-10-28 | R1 | Phase plan R2–R11: the illustration set (R3) comes before the landing rebuild (R5) | Owner request |
| 2026-10-28 | R1 | `apps/web/.prettierignore` ignores `.impeccable` (a local design-hook cache, already git-ignored) | It broke `prettier --check .` |
| 2026-10-28 | R2 | Button variants: `primary` (ink), `highlight` (yellow + ink outline; marketing and at most one per product view), `secondary`/`outline` (ink outline, the neutral default the product already uses in 23 places), `ghost`, `danger`, `inverse` (on the ink featured card), `link` | Keeps yellow rare in the product; no call-site churn |
| 2026-10-28 | R2 | `Button` no longer has `outline-none`; the global 2px focus outline applies | It hid the focus ring on every Button for keyboard users (found while checking R1) |
| 2026-10-28 | R2 | Accent links (`text-accent-soft`) are always underlined | The accent is now ink like body text; hover-only underlines would fail axe link-in-text-block |
| 2026-10-28 | R4 | Sidebar tip/watchlist card, its per-request `rule_gcs` query and the sidebar GitHub link removed; worker status moved into the account menu | Owner decision; one fewer RPC per page |
| 2026-10-28 | R4 | Dev-only `/dev/shell` renders the real `AppShell` with mock data and is in the `ui.spec` axe gate | Lets the signed-in chrome be checked without a database |
| 2026-10-28 | R5 | Landing rebuilt per DESIGN.md §9; anchors `#how-it-works`, `#example`, `#trust`; announcement bar, typewriter, pipeline loop, stats bands, carousel and pixel sprites deleted | Owner decision |
| 2026-10-28 | tooling | `make` falls back to `npx --yes supabase@2` when the Supabase CLI isn't installed; `make db-start lite=1` skips Studio, mail, analytics, image proxy and edge functions; `scripts/local-supabase-env.sh` gives a fresh clone (no `apps/web/.env.local`) local defaults for `NEXT_PUBLIC_SITE_URL` and a refusing `DISCORD_WEBHOOK_URL`, checking only key names, and fails with "make db-start" when the stack is down | `make dev-web-local` didn't work on a machine without `.env.local` or a global CLI; no `.env` file is created or read |

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
| opencv-python-headless | Apache-2.0 | P11 |
| scikit-image, scipy (transitive) | BSD-3-Clause | P11 |
| pytesseract | Apache-2.0 | P11 |
| Tesseract OCR (system binary, Docker `tesseract-ocr`) | Apache-2.0 | P11 |
| paddleocr, paddlepaddle (optional extra `ocr-paddle`, not installed by default) | Apache-2.0 | P11 |
| recharts | MIT | P13 |
| geist | OFL-1.1 (fonts) / MIT | U0 (restored on main 2026-10-27) |
| motion | MIT | U0 (restored on main 2026-10-27) |
| cmdk | MIT | U0 (restored on main 2026-10-27) |
| geist | (removed) | R1, `UI/UX_jagpreet`: replaced by DM Sans/DM Mono |
| DM Sans, DM Mono (fonts via `next/font/google`, no npm package) | OFL-1.1 | R1, `UI/UX_jagpreet` |

## Open questions (ask the user; don't guess)

- [x] Build window Day-1 date: 2026-10-20 (D7 = 2026-10-26), user 2026-10-27.
- [x] Worker host: **Render** (Dockerfile + `render.yaml` Blueprint, free tier), user decision 2026-10-26.
- [x] Cloud Supabase: user approved pushing migrations + demo seed (2026-10-26).
- [x] Email: Discord webhook alerts only, no Resend (user, 2026-10-27).
- [x] Merge P11 to `main` (user, 2026-10-26).
- [x] Approve `make seed-demo url=<cloud>` for P11: approved and run (2026-10-26).
- [x] Merged P12/P13 to `main`, migrations `…100018`/`…100019` applied to cloud, redeployed (user, 2026-10-27). Was: **Merge P12 to `main` and deploy?** It needs migration `20261026100018_review_run_pages.sql` applied to cloud Supabase *before* the Vercel deploy (the web reads `review_runs.pages`), then Render + Vercel redeploys.
- [x] Model IDs in `apps/worker/.env` confirmed current (user, 2026-10-27). Was: **Update model IDs in `apps/worker/.env`** (see the P03 handoff; the configured Groq/Gemini models are retired).
- [ ] **Judging date for Round 2?** Needed to plan when the redesign branch can merge (owner left it blank on 2026-10-28).
- [ ] **Interviewee names on the landing page?** "What we heard" uses role + city only. Confirm consent before adding names or verbatim quotes (DESIGN.md §8.8).

## Known issues / debt

- PDFs (P12): vector-drawn logos aren't detected; scanned PDFs (no text layer) are rejected (`no_text_layer`); VS-02 warmth isn't judged for pictures inside decks (counted as `cool_images` only); reading grade highlights the first word of the PDF.
- Peak RSS for a 40-page deck in the worker image is 484 MB against Render's 512 MB. It's flat in page count, but the margin is thin; the serving worker also holds FastAPI and the LLM SDKs. Consider a 1 GB instance before heavy PDF use.
- Worker Docker image: 4.04 GB → 1.73 GB (P15: builds as `app`, no `chown -R` layer, no uv cache; verified locally 2026-10-27). P11 adds ~240 MB (scipy, OpenCV, scikit-image) and Tesseract (~100 MB apt layer, shared with libgomp).
- Contrast on JPEG uploads is an estimate (4:2:0 chroma smears thin coloured strokes; 7/20 within ±0.1 at q85); the finding says so. PNG is exact.
- Groq free-tier 429 backoff can push one image review to ~30 s when several run within a minute (P95 target 15 s); revisit in P15 load testing.

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
