# UI redesign: flat outlined look, Errata rename, How it works video

**Draft, for review by Maanit. Do not merge yet.** Production deploys from `main`, so nothing here ships until this is reviewed and merged on purpose.

## What this changes

The web app gets a new look, a new user-facing name and a demo video. The workflow and data model are unchanged.

1. **Visual system (R1–R6).** Light-first, flat and outlined: white surfaces, 2px ink outlines, yellow fills with black text for primary actions and the active nav item, pink and grey section bands, DM Sans for text and DM Mono for IDs only. The dark theme is kept.
   - **Tokens** are defined once as `light-dark()` pairs in `apps/web/app/globals.css` and mirrored in `lib/design/tokens.ts`. `tests/tokens.contrast.test.ts` checks every text/background pair for WCAG AA in both themes.
   - **Colour rules.** ESLint now bans raw hex, Tailwind palette classes and yellow text in `.tsx`. Yellow is fill only; the warning colour is a separate amber and always carries an icon and a label.
   - **Visuals.** Original inline-SVG illustrations and a new wordmark. No third-party artwork or template assets are used.
   - **What it covers.** Primitives, shared components, the app shell, the landing page, the public AI-use page and sign-in are all restyled. `docs/DESIGN.md` is rewritten to match, and §14 tracks status.
2. **Rename to Errata (user-facing only).** UI text, metadata and docs prose now say Errata.
   - **Unchanged:** internal identifiers keep `brandlens`. That covers the worker package, cookies, env names, queue names and the DB.
   - **Lists:** PROGRESS.md → Decisions lists the kept identifiers.
   - **README:** not edited here. The suggested line changes are in `docs/ui-redesign/README-rename-notes.md` for the README owner.
3. **How it works video.** A 60-second silent demo with captions, built from real captures of the local app using the fictional PayWise data only. It is embedded on the landing page.
   - **Files** in `apps/web/public/demo/`:
     - MP4, 5.2 MB
     - WebM, 4.3 MB
     - poster
     - WebVTT captions
   - **Playback:** it never autoplays, and a text transcript sits under the player.
   - **Config changes:** the CSP gains `media-src 'self'`, and `proxy.ts` skips `.mp4`, `.webm` and `.vtt`.
   - **Source** is in `apps/web/video-src/`. Generated renders and caches are git-ignored.

## Invariants kept

- Every finding still shows its rule, fact or WCAG ID. The finding UI still refuses to render a finding with no citation.
- There is no Publish button. Disabled actions still show their reason.
- Source tags, model and prompt versions, and override reasons are unchanged.
- No workflow logic changed. State changes still go only through `transition_content()`.

## Outside `apps/web` and `docs`

| File | Why | Commit |
|---|---|---|
| `Makefile` | Falls back to `npx supabase@2` when the CLI isn't installed. Adds `make db-start lite=1`, which skips optional containers on low-disk machines. | `b6ca2ac` |
| `scripts/local-supabase-env.sh` | Local-only defaults for `NEXT_PUBLIC_SITE_URL`, `DISCORD_WEBHOOK_URL` and the worker's LLM keys (placeholders, so reviews run in degraded mode). They are used only when a key is missing from the env files, and the script prints a clear error when the stack is down. | `b6ca2ac`, `9344a1a` |
| `.gitignore` | Ignores the video renders and HyperFrames caches. | `6560d3e` (with the video source) |
| `pnpm-lock.yaml` | Drops `geist`; the DM fonts load through `next/font/google`. | `a459152` (with the font change) |
| `CLAUDE.md`, `PROGRESS.md` | The DESIGN.md row and the product name; phase rows, handoff, decisions, and dependency licences. | docs commits |

`apps/worker`, `supabase/` and `apps/web/types/database.ts` are not touched.

## New dependencies and licences

- **DM Sans and DM Mono:** SIL OFL 1.1, loaded via `next/font`.
- **Video build only, not shipped in the app bundle:**
  - GSAP: Standard "no charge" license, vendored in `video-src/composition/vendor/`
  - HyperFrames: Apache-2.0, run through `npx`

All of these are logged in PROGRESS.md → Decisions.

## Checks run

All checks were run on `UI/UX_jagpreet` at the head of this PR.

- `pnpm lint`, `pnpm format:check` and `pnpm typecheck` all pass.
- `pnpm test` passes: 188 Vitest tests.
- Playwright `ui`, `keyboard` and `a11y` specs (axe, visible focus outline on every tab stop) passed against the local stack. `auth`, `drafts`, `review`, `vault`, `vault-import` and `core-loop` passed earlier in the branch.
- Pre-push audit:
  - no secrets in the diff (placeholder keys only)
  - no reference screenshots, handout PDF or third-party assets in any commit
  - no file over 5 MB except the demo video
  - 202 files changed, about 28 MB of added files, mostly screenshots and the video

## How to try it

```sh
make db-start lite=1   # local Supabase without optional containers
make dev-local         # web on :3000, worker on :8000
```

Open http://localhost:3000. The video is under "How it works". Use the demo role switcher on /login for the app.

## Review notes

- **Screenshots** of each step are in `docs/screens/before-redesign`, `docs/screens/R1` and `docs/screens/R2`.
- **Open items** are listed in `docs/DESIGN.md` §14 and the PROGRESS.md handoff:
  - the feature screens (R7–R10) have had a first pass only, and their page layouts and copy trims are still to do
  - the 21st.dev component ports (R2) are still to come
  - the R11 polish pass hasn't started
- **Video size:** the video adds about 9.5 MB to `public/`. If that's too much for the repo, the MP4 and WebM could move to Supabase Storage or a release asset in a follow-up.
