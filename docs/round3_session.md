# Round 3 session log

- **Project:** Errata (formerly BrandLens; internal identifiers still say `brandlens`). Team 9thHACK: Jagpreet Singh (team leader) and Maanit Gupta, SRMIST. Inkloom AI brand-governance problem statement, We Code Coders. Round 3 (final) submission: **2 Nov 2026**.
- **Branch:** `round3/improvements` (never `main`). Repo: https://github.com/maanit-gupta/Errata
- **How to resume:** read this file, then [`PROGRESS.md`](../PROGRESS.md) and [`CLAUDE.md`](../CLAUDE.md), then continue at the last **Next step** at the bottom of the running log.
- **Rules in force (owner, 2026-10-31/11-01):** work only on `round3/improvements`; never push to `main`, merge or open a PR into `main` without the owner's go-ahead; no cloud actions (Supabase `db push`, Vercel/Render changes, live load tests) without the go-ahead; `make check` before every push; no secrets anywhere; no `Co-Authored-By` / `Claude-Session` / "Generated with Claude Code" lines; commit as Jagpreet Singh; add files by name (never `git add -A`; an unrelated untracked PDF sits in the owner's folder); keep the README AI-assistance disclosure accurate; report only measured numbers; never invent usability results; no history rewrite until the owner says "rewrite history".

## History so far

Seeded from the owner's summary (2026-11-01), then checked against `PROGRESS.md`, `docs/REPORT.md`, `docs/CHANGELOG-R3.md` and `git log`.

- **Round 1 (25 Oct):** plan PDF submitted as BrandLens; renamed Errata and rebuilt on 29 Oct (27 pages, plus a Round 3 page and the repo link). *Not verifiable from the repo* (`docs/plan.pdf` is the only copy; PROGRESS.md doesn't record the submission date).
- **Round 2:** P00–P16 done: the six-stage pipeline, citation gate, vault, workflow, image/PDF checks, Guideline Clarity Score, eval gate, hardening. Golden set: blocker recall 1.00, 0 uncited findings, P95 15.2 s (target 15 s, just missed; README → Results). UI redesign (flat, outlined, light-first) and the Errata rename merged to `main` on 29 Oct. Live app https://brandlens-app.vercel.app (Vercel) plus the Render worker. P16 is still `partial` in PROGRESS.md (team items: usability sessions, repo public, demo dry run).
- **Round 3 commitments:** (1) read-only MCP server; (2) real-user testing plus the Clarity Score on real data; (3) load test plus an "AI check pending" state.
- **Done on `round3/improvements` (none on `main`), from `git log origin/main..round3/improvements`:**

  | Commit | What | Author |
  |---|---|---|
  | `7ed8614` | First MCP server (campaign-scoped tokens), later **replaced** | Claude |
  | `6968cd7` | Its settings card, `mcp_check.py`, docs, later **replaced** | Claude |
  | `eeae79e` | Clarity Score real-data filter (`contents.simulated`) + usability kit | Claude |
  | `14d2d44` | "AI check pending" (delayed pgmq retry, banner, DB tests) | Claude |
  | `0176583` | MCP server rebuilt from the build spec, read-only subset: `get_campaign_context`, `precheck_draft_fast`, `verify_claim_evidence`, resource, prompt; personal `bl_mcp_` keys | Claude |
  | `d19c525` | PROGRESS.md decisions-table fix | Claude |
  | `e9f84ba` | `.claude/settings.json`: attribution trailers off | Jagpreet Singh |
  | `a6ec0fb` | Load test (`make load-test`, simulated rate limit) | Jagpreet Singh |
  | `5c0aa39` | Usability kit: T5/T6 and the pending-banner probe | Jagpreet Singh |
  | `a6229a1` | REPORT, CHANGELOG-R3, PRIVACY-SECURITY-A11Y, README, handoff | Jagpreet Singh |

  Hashes change if history is rewritten (prepared, not run; commands are in the 2026-10-31 chat and reproduced in the log below).
- **Verified on Jagpreet's MacBook, real Supabase stack (2026-10-31, at `d19c525`):** `make db-reset` applies all 24 migrations; `make check` green; pgTAP 9 files / 147 tests pass; worker 239 passed / 7 skipped; web 188 passed. Use 147 everywhere.
- **Not yet done by Jagpreet:** `make mcp-check` and `make load-test` on the MacBook; the 7 DB-gated worker tests on his stack; the usability sessions (8–15 people); the demo video; applying migrations `…100022`–`…100024` to the cloud project; merging; the form submission.

### Mismatches found while checking

1. The seed lists the MCP server as `0176583, 6968cd7, 7ed8614`. Only `0176583` is the shipped server: `7ed8614` and `6968cd7` were the first campaign-token version, which `0176583` replaced (migration `…100022` was rewritten before it was applied anywhere).
2. The seed omits `d19c525` (PROGRESS fix) and `e9f84ba` (attribution settings).
3. Six of the ten branch commits are still authored "Claude <noreply@anthropic.com>" with trailer lines; the four since `e9f84ba` are authored by Jagpreet Singh. The prepared history rewrite would fix the six.
4. Test counts: the MacBook figure (worker 239 passed / 7 skipped) was measured at `d19c525`. Commit `5c0aa39` added 2 tests, so the MacBook should now show 241 / 7. *Expected, not measured.* The sandbox shows 239 passed / 9 skipped at `a6229a1` (2 extra skips need the embedding model).
5. `docs/REPORT.md` and the README describe the MCP, load and DB-gated results as **sandbox / plain Postgres**. That's consistent with the seed's "not yet done by Jagpreet" list.

## Running log (newest at the bottom)

Times are commit times in IST (`TZ=Asia/Kolkata git log --date=format-local:%H:%M`). The first versions of the Hero 3/4/2 entries carried estimated times; corrected at 14:50.

### 2026-11-01 14:29 IST: session continuity + plan for the V5 extras (Heroes 2–5)

- **Did:** created this file; saved the owner's spec as [`docs/specs/V5_remaining_heroes_spec.md`](specs/V5_remaining_heroes_spec.md); checked the branch (`a6229a1` local = remote; no history rewrite yet); checked the seed against the repo (mismatches above).
- **Commands:** `git fetch`, `git log origin/main..HEAD`, `grep` over PROGRESS.md.
- **Plan (timebox ~5 h; build order 3 → 4 → 2 → 5; stop any hero that fails its own PASS IF):**

  | Order | Hero | Budget | Approach (adapted to the repo) | Cut first if short |
  |---|---|---|---|---|
  | 1 | **3 Visual auto-heal** | 1 h | `vision/autoheal.py` reuses `vision/contrast.py`; candidates come only from the org's palette asset (no hardcoded hexes); the suggestion is stored on the WCAG contrast finding and shown as a preview; nothing is applied until **Accept**. 20 labelled samples as fixtures | The preview UI polish |
  | 2 | **4 Cross-modal** | 1.25 h | `pipeline/cross_modal.py`: dates, percentages and times across caption, OCR text (from the existing OCR stage) and an optional landing-page text; cites the vault fact that applies, else no finding (citation gate); 20 labelled posts (10 conflicting, 10 consistent) | URL text input in the UI |
  | 3 | **2 Manifest + kill-switch** | 1.5 h | New migration: `content_fact_dependencies`, `versions.content_hash`/`publish_manifest`; system transitions approved/publish_ready → needs_revision **through `private.apply_transition`** (reason + audit); trigger on fact edits plus a sweep function for expiry that the worker calls every minute; dependencies written from the deterministic facts stage; manifest recorded at publish_ready; badge in the review UI | The badge UI (data + tests first) |
  | 4 | **5 Shadow sandbox** | 1.25 h | `/v1/heroes/simulate-rule` (authenticated, org-scoped); local bge-small only; the repo's real GCS formula; fewer than 10 findings → "insufficient data"; output labelled a projection; deterministic | Whole hero if time runs out |

- **Next step:** Hero 3 (done, see below).

### 2026-11-01 14:38 IST: Hero 3, visual auto-heal (commit `2b4dc25`)

- **Did:** `apps/worker/brandlens_worker/vision/autoheal.py` (reuses `vision/contrast.py` and the CIEDE2000 in `vision/colour.py`). For each failing WCAG 1.4.3 text line it picks the smallest on-palette change: text first, then background, then both; ties keep palette order. Candidates come only from the org's palette asset (no black/white fallbacks). Attached to the finding in `pipeline/image.py` as `visual_fix` (migration `20261101100025_visual_autoheal.sql`; worker-written only). Web: `lib/drafts/visual-fix.ts` (strict `#RRGGBB` zod parse, because the colours become inline styles), `components/review/visual-auto-heal-preview.tsx`, finding card "Accept palette fix" (records the status only; nothing touches the image), draft and review pages select `visual_fix`. 20 labelled samples in `apps/worker/tests/fixtures/autoheal_samples.json`.
- **Measured (sandbox):** 20/20 labelled samples behave as labelled: 18 fixes, every one from the palette and ≥ 4.5:1 (≥ 3:1 for the 2 large-text cases), recomputed from the hexes; the 2 pastel-only cases get no suggestion; deterministic. The real `05-low-contrast.png` creative gets an on-palette preview with `applied: false`. Worker 266 passed / 9 skipped; web 191 passed; lint green; pgTAP `09_r3_heroes` 3/3 (plain Postgres); the pending-flow DB tests still pass through the changed findings INSERT (6/6).
- **Accessibility:** kitchen sink 0 serious/critical in both themes. **Finding:** the MCP dialog preview on the kitchen sink opened a modal that made the rest of the page inert, so earlier axe runs checked only 26 rules instead of 33. Moved the preview behind `?mcpPreview=1`; both views now have 0 violations (33 and 26 rules).
- **PASS IF (Hero 3):** every fix from the palette and reaching 4.5:1 / 3:1 on 20 samples, none applied without Accept → **PASS** (sandbox).
- **Didn't run:** the image pipeline end to end on the real stack (needs Storage); the signed-in draft page with an image finding.
- **Verify on the MacBook:** `make db-reset && make check`; then `make dev-local`, upload `fixtures/paywise/creatives/05-low-contrast.png` as Creator, submit, and check the WCAG 1.4.3 card shows the preview and "Accept palette fix".
- **Next step:** Hero 4 (done, see below).

### 2026-11-01 14:42 IST: Hero 4, cross-modal reconciliation (commit `dff6208`)

- **Did:** `apps/worker/brandlens_worker/pipeline/cross_modal.py`, run in stage 3 for every format. It compares the checked text (OCR of an image, or a text draft's body) with the post's other surfaces from the intent: `caption` (image posts; until now image posts had no caption at all, since `versions.body` is text-only) and `landing_page_text` (any post). It reuses `filters/entities.extract` (so "Oct 28" = "28/10", "7 PM" = "19:00") and `filters/facts.fact_attrs`. Every conflict cites the in-scope, unexpired vault fact that applies: the fact whose value appears on either surface, else the only fact of that kind. **No hardcoded E-19; with no applicable fact there's no finding** (invariant 1). Percentages count only next to that fact's keywords. Findings are anchored on the checked text (with the image box) and carry `span.counterpart` (surface, offsets, quote); `model_version` "deterministic" and `prompt_version` `cross_modal@1` are recorded. Web: optional Caption (images) and Landing page text fields. Neither goes to the LLM (only goal/audience/CTA/channel do). No migration needed.
- **Measured (sandbox):** 20 labelled posts in `apps/worker/tests/fixtures/cross_modal_posts.json`: **10/10** conflicting posts flagged, each citing the right fact and both spans; **0/10** false flags on consistent posts. A banner rendered with OpenCV and read by the real OCR stage (Tesseract here) is flagged against its caption and anchored on the image box. Negative control: removing the keyword rule makes k07 false-flag (10/1), so the test catches it. Worker 292 passed / 9 skipped; web 191; lint/mypy green; DB tests 9/9 (plain Postgres).
- **PASS IF (Hero 4):** ≥ 9/10 conflicts flagged citing both spans, 0 flags on 10 consistent → **PASS** (sandbox).
- **Limits:** caption vs landing-page conflicts on an image post aren't compared unless the image text is involved (findings must anchor on the checked text). The caption itself isn't run through the LLM pass.
- **Didn't run:** an image post end to end on the real stack (Storage plus the real worker).
- **Verify on the MacBook:** `make check`; then `make dev-local`, upload an image whose text says "Oct 18, 7 PM", set Caption "Join us Oct 28 at 7 PM", submit, and expect an E-19 blocker naming both.
- **Next step:** Hero 2 (done, see below).

### 2026-11-01 14:49 IST: Hero 2, publish receipt + fact kill-switch (commit `4a17db7`)

- **Did:** migration `20261101100026_fact_kill_switch.sql`:
  - `content_fact_dependencies` and `publish_manifests`, both with RLS (readable with the content; no user writes).
  - **Versions are immutable** (`versions_immutable` trigger), so the receipt lives in `publish_manifests`, not on `versions` as the spec said.
  - `private.apply_transition` redefined, generated from the original text plus one system-only branch: approved/publish_ready → needs_revision, reason required, audited like every transition.
  - Entering publish_ready issues the receipt: SHA-256 of the trimmed, whitespace-collapsed body (file versions record no hash), the dependent facts and the earliest expiry. Leaving publish_ready revokes it.
  - Trigger on facts: edits to value, statement or disclaimer, an expiry set by an edit, and deletes (a BEFORE trigger, so the dependency rows still exist).
  - `public.sweep_expired_fact_dependencies()` for dates that simply pass, called by the worker every 60 s (`main.sweep_facts`, `config.FACT_SWEEP_INTERVAL_S`).
  - The worker writes dependencies on every run from the facts stage (`filters/facts.dependent_fact_ids`, plus facts its findings cite).
  - Review page: `components/review/publish-manifest-badge.tsx` (active receipt, revoked receipt, kill-switch notice); the audit log labels `fact_kill_switch`.
  - `brandlens_worker/manifest.py` mirrors the hash.
- **Measured (plain Postgres + sandbox):**
  - pgTAP `10_fact_kill_switch` **22/22**. Editing F-048 moves approved A to needs_revision at once; draft D (same fact) and approved C (other fact) are untouched; the transition is audited with system=true and a reason; an embedding-only update does nothing; an expiry with the trigger disabled is caught by **one** sweep (the second sweep returns 0); the receipt hash equals SHA-256 of the normalised body; the receipt is revoked with the reason; deleting F-112 moves C; users can't revoke approvals or write dependencies; non-members see nothing.
  - Negative control: dropping the edit trigger fails exactly the 3 "at once" assertions.
  - Full pgTAP **172/172** (147 + 3 + 22).
  - DB tests: a real review writes dependencies E-19/F-048/F-112; the SQL hash = Python hash on 6 inputs (tabs, NBSP, CJK, empty); the worker's real sweep loop moves an approved item whose fact expired silently.
  - Worker 297 passed / 17 skipped (8 new DB-gated); web 191; lint green; kitchen-sink axe 0 violations in both themes.
- **PASS IF (Hero 2):** edit → affected approved/publish_ready items back to revision at once; expiry within one sweep; unrelated untouched → **PASS** (plain Postgres).
- **Limits:** the creator's draft page doesn't show the kill-switch reason yet (the review page and the audit trail do). File versions get a receipt without a content hash.
- **Didn't run:** the real Supabase stack (CLI). The Realtime refresh of the badge needs the real stack.
- **Verify on the MacBook:** `make db-reset && make test-db` (expect 172 pgTAP); `cd apps/worker && TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres uv run pytest -q tests/test_fact_kill_switch_db.py tests/test_llm_pending.py tests/test_mcp_server.py`.
- **Next step:** Hero 5 (done, see below).

### 2026-11-01 14:56 IST: Hero 5, GCS shadow backtest (commit `9f93dc5`)

- **Did:**
  - `apps/worker/brandlens_worker/heroes/gcs_shadow.py` (pure) and `heroes/api.py`: `POST /v1/heroes/simulate-rule`.
  - **Auth:** the caller's Supabase session token, verified with Supabase Auth (`GET /auth/v1/user`, cached for 60 s); the user must be brand admin or manager in the **rule's** org (a wrong role gets the same 404 as a missing rule); strict Pydantic input (`extra="forbid"`); 30 runs a minute per user; logs carry IDs, counts and ms only.
  - **Current GCS** = SQL `rule_gcs()` (the dashboard's own number, same 90-day window and real-data filter).
  - **Projection:** re-scores only the dismissal rate on the last 30 findings with the worker's embedder (closer to the "do" anchor than to the rule + "don't" anchor → stops triggering). False positives removed **and** true positives lost are both reported; override and low-confidence rates are held, not invented; fewer than 10 findings → "insufficient data" with no numbers.
  - The spec's fallback numbers (60→91, 0.42→0.08), its `× 0.4` and its version-level decisions join are **not** used. Python `round()` matches SQL `round(double)` (both half-to-even; checked in psql: `round(72.5::double precision) = 72`).
  - Web: server action `simulateRuleShadow` (forwards the user's own token, server-side; needs `WORKER_URL`) and `components/insights/gcs-shadow-simulator.tsx` in the suggested-examples drawer (idle, loading, error, insufficient-data and projection states; honours the Insights real-data filter).
- **Measured (sandbox, stand-in embedder):** unit tests 12/12 (projection rules, insufficient data at n = 0/1/9, no current score → no numbers, API 401/404/422/429, logs). DB test on plain Postgres: 30 findings on TV-04 backtested **twice → identical output**; both calls together **0.15 s**; `current_gcs` equals SQL `rule_gcs`; insufficient data at 5 findings. Worker 309 passed / 19 skipped; web 191; DB tests 19/19; kitchen-sink axe 0 violations in both themes.
- **PASS IF (Hero 5):** 30-draft backtest < 60 s and identical output twice → **PASS** (plain Postgres, stand-in embedder). Timing with real bge-small: needs the MacBook.
- **Limits:** the "do vs don't anchor" rule (margin ≥ 0) is uncalibrated, like the MCP claim threshold; the projection is labelled as one in the UI and the API.
- **Didn't run:** the real worker with real bge-small; the Next server action → worker call (needs `WORKER_URL` and a signed-in session on the real stack).
- **Verify on the MacBook:** run the DB tests command (see Hero 2) plus `tests/test_gcs_shadow_db.py`; then with `make dev-local` and `WORKER_URL=http://localhost:8000` exported for the web app, `make simulate-activity`, sign in as Brand admin → Insights → TV-04 → Review 3 examples → "Run on recent findings".
- **Next step:** docs (done, see below).

### 2026-11-01 14:58 IST: docs for the extras + handoff

- **Did:** README (an "Extras" table under Round 3 improvements, test totals, an AI-assistance row), `docs/REPORT.md` (an extras table with PASS IF, result and source per hero), `docs/CHANGELOG-R3.md` (the extras plus a "spec said / built / why" deviations table), `docs/PRIVACY-SECURITY-A11Y.md` (new stored data, the `/v1/heroes` auth), `PROGRESS.md` (R3.5 row, 8 decisions, handoff; merge now needs migrations `…100022`–`…100026`).
- **State at hand-off:** every hero meets its PASS IF in the sandbox or on plain Postgres; **none has run on the real stack**. Totals: pgTAP 172/172 (11 files), worker 309 passed / 19 skipped, web 191 passed, DB-gated tests 19/19, lint/mypy/tsc/Prettier green.
- **Cloud migrations (not applied; owner's go-ahead needed), in order:** `20261031100022_mcp_api_keys.sql`, `20261031100023_insights_real_data.sql`, `20261031100024_llm_pending.sql`, `20261101100025_visual_autoheal.sql`, `20261101100026_fact_kill_switch.sql`.
- **Next step (owner, on the MacBook, real Supabase stack):**
  1. `git pull` on `round3/improvements`; `make db-reset && make check` (expect pgTAP 172 in 11 files; worker ~311 passed / 19 skipped, since the MacBook has the embedding model, *expected, not measured*; web 191).
  2. DB-gated tests: `cd apps/worker && TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres uv run pytest -q tests/test_llm_pending.py tests/test_mcp_server.py tests/test_fact_kill_switch_db.py tests/test_gcs_shadow_db.py` (expect 19 passed).
  3. `make dev-local` + `make mcp-check`; stop the worker, then `make load-test note="MacBook …"`.
  4. Smoke the extras in the UI (commands in the Hero 3/4/2/5 entries above).
  5. Signed-in axe: `cd apps/web && pnpm exec playwright test e2e/ui.spec.ts e2e/keyboard.spec.ts e2e/a11y.spec.ts`.
  6. Update the "sandbox / plain Postgres" labels in README, REPORT and this log with the MacBook numbers.
  7. Usability sessions; then, on the owner's go-ahead: `supabase db push` (dry run first), PR → `main`, merge, and optionally "rewrite history".
