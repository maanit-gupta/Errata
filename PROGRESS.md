# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P14 (P13 done on `phase/P13-gcs-insights`, stacked on unmerged P12)
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | done | M (Claude) | phase/P00-bootstrap | 2026-10-26 |
| P01 | DB schema, RLS, queue, seed | M | done | M (Claude) | phase/P01-schema | 2026-10-26 |
| P02 | Web shell, auth, demo switcher | J | done | M (Claude, /complete) | phase/P02-web-shell | 2026-10-26; tasks 1–2 (tokens/restyle) move to U0 |
| P03 | Worker core | M | done | M (Claude) | phase/P03-worker-core | 2026-10-26 |
| P04 | Vault ingestion & PayWise kit | M | done | M (Claude) | phase/P04-vault-ingestion | 2026-10-26 |
| P05 | Vault admin UI | J | done | M (Claude, /complete) | phase/P05-vault-ui | 2026-10-26 |
| P06 | Pipeline stages 1–4 | M | done | M (Claude) | phase/P06-pipeline-1-4 | 2026-10-26 |
| P07 | Stages 5–6: LLM, gate, intent | M | done | M (Claude) | phase/P07-llm-gate | 2026-10-26 |
| P08 | Editor & findings UI | J | done | M (Claude, /complete) | phase/P08-editor-findings | 2026-10-26 |
| P09 | Review workflow & notifications | J+M | done | M (Claude, /complete) | phase/P09-review-workflow | 2026-10-26 |
| P10 | Deploy & core-loop E2E 🎯 D7 | Both | done | M (Claude) | phase/P10-deploy → main | 2026-10-26; prod e2e 3/3 green |
| P11 | Image checks | M | done | M (Claude) | phase/P11-image-checks | 2026-10-26; eval 9/9 logos, 20/20 contrast |
| P12 | PDF decks & overlays | M+J | done | M (Claude, /complete) | phase/P12-pdf-decks | 2026-10-26; deck 9/9, 40 pages 7.0 s / 484 MB in 512 MB container; not merged |
| P13 | GCS & insights 🎯 D11 | J+M | done | M (Claude, /complete) | phase/P13-gcs-insights | 2026-10-27; stacked on P12; tag `v0.11-feature-complete` (local); not merged |
| P14 | Golden set & eval gate | M | todo | | | |
| P15 | Hardening | Both | todo | | | |
| P16 | Docs & submission 🎯 D14 | J | todo | | | |
| U0 | Design-system foundation (DESIGN.md §12) | J | done | M (Claude, /complete-ui) | ui/U0 | 2026-10-27; worktree .claude/worktrees/ui |
| U1 | Public landing + /ai-use (DESIGN.md §8) | J | todo | | | |
| U2 | UI polish and audit (DESIGN.md §12) | J | todo | | | |

## Handoff (latest — overwrite each phase)

- **Phase / status:** P13 / **done** (2026-10-27) on `phase/P13-gcs-insights`, stacked on P12. Neither P12 nor P13 is merged or deployed; cloud migrations `20261026100018` and `20261026100019` aren't applied yet (see Open questions).
- **What exists now:**
  - SQL (`20261026100019_insights.sql`): `rule_gcs`, `insights_summary`, `flag_unclear_rules`, `decide_example_suggestion`; pgTAP `05_insights` (20 tests).
  - Worker: `generate_examples` job, `prompts/examples_v1.md`, `pipeline/examples.py`, Discord `notify_unclear_rule`; `review_version` calls `flag_unclear_rules` after every review.
  - `make simulate-activity` gives TV-04 41/60 UNCLEAR, VS-02 22/73, CL-03 63/97, G-07 88/99 (plan p.19).
  - Web: `/insights` (KPI tiles, chart + table, watchlist, suggestions drawer), `/settings/ai-use` models list.
  - Verified 2026-10-27: `make check` green (171 pytest, 74 Vitest, 100 pgTAP). Full Playwright suite on a fresh `db-reset → seed-assets-local → simulate-activity` passes. TV-04 v2 was re-embedded (new `embedding_source_hash`).
- **Day-11 checklist:** image and PDF overlays (`image-check`, `pdf-check`), risk routing, comments and diff (`review`, `core-loop`), and the GCS dashboard (`insights`) all pass locally. Tagged `v0.11-feature-complete` locally (not pushed).
- **Gotchas:**
  - `e2e/insights.spec.ts` isn't re-runnable: it approves TV-04 v2. Run `make db-reset && make seed-assets-local && make simulate-activity` first.
  - Local `make dev-local` posts to the real Discord webhook if one is configured.
- **Exact next step:** P14 (golden set and eval gate).

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
| geist | OFL-1.1 (fonts) / MIT | U0 |
| motion | MIT | U0 |
| cmdk | MIT | U0 |

## Open questions (ask the user; don't guess)

- [ ] Build window Day-1 date?
- [x] Worker host: **Render** (Dockerfile + `render.yaml` Blueprint, free tier), user decision 2026-10-26.
- [x] Cloud Supabase: user approved pushing migrations + demo seed (2026-10-26).
- [ ] Is Resend email wanted, or Discord only?
- [x] Merge P11 to `main` (user, 2026-10-26).
- [x] Approve `make seed-demo url=<cloud>` for P11: approved and run (2026-10-26).
- [ ] **Merge P12 to `main` and deploy?** It needs migration `20261026100018_review_run_pages.sql` applied to cloud Supabase *before* the Vercel deploy (the web reads `review_runs.pages`), then Render + Vercel redeploys.
- [ ] **Update model IDs in `apps/worker/.env`** (see the P03 handoff; the configured Groq/Gemini models are retired).

## Known issues / debt

- PDFs (P12): vector-drawn logos aren't detected; scanned PDFs (no text layer) are rejected (`no_text_layer`); VS-02 warmth isn't judged for pictures inside decks (counted as `cool_images` only); reading grade highlights the first word of the PDF.
- Peak RSS for a 40-page deck in the worker image is 484 MB against Render's 512 MB. It's flat in page count, but the margin is thin; the serving worker also holds FastAPI and the LLM SDKs. Consider a 1 GB instance before heavy PDF use.
- Worker Docker image is ~4 GB unpacked: the `chown -R app:app /app` layer (P10) duplicates the venv (943 MB). Use `COPY --chown` / run `uv sync` as the app user (P15). P11 adds ~240 MB (scipy, OpenCV, scikit-image) and Tesseract (~100 MB apt layer, shared with libgomp).
- Contrast on JPEG uploads is an estimate (4:2:0 chroma smears thin coloured strokes; 7/20 within ±0.1 at q85); the finding says so. PNG is exact.
- Toasts (bottom-right) cover the intent panel's submit button and stay while hovered. Consider `position="top-center"` or offsetting the toaster (Jagpreet, UX).
- Groq free-tier 429 backoff can push one image review to ~30 s when several run within a minute (P95 target 15 s); revisit in P15 load testing.

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
