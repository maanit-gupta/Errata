# Errata demo video: Round 3 cut ("What's new")

The landing page's "How it works" video, re-made on 2026-11-03 to show the Round 3 features
clearly. 87 s, 1920×1080, 30 fps, silent with burned-in captions, plus a captions track and a
transcript.

| File | What it is |
|---|---|
| [`errata-whats-new.mp4`](errata-whats-new.mp4) | The video (H.264, 7 MB). The site serves the same file from `apps/web/public/demo/`, plus a WebM |
| [`errata-whats-new-poster.jpg`](errata-whats-new-poster.jpg) | Poster frame (the "Six things are new" list) |
| [`errata-whats-new.en.vtt`](errata-whats-new.en.vtt) | Captions (WebVTT); the transcript in `apps/web/components/marketing/demo-video.tsx` matches it, checked by a unit test |
| [`round2/`](round2/) | The first video (60 s, 2026-10-28), kept for the record |

Watch it on the [live landing page](https://brandlens-app.vercel.app/#how-it-works) once `main` is
deployed.

## How it was made

Following the "Motion graphics with Claude Code" handout: the video is a web page (HTML, CSS and a
GSAP timeline) that HyperFrames renders frame by frame. Same look and tooling as the first video.

- **Brag rubric.** The first video was planned with the brag plugin's `/brag-slim` skill. The plugin
  isn't available in the cloud session this cut was made in, so the same rubric was answered by
  hand (below) and the first video's plan (`apps/web/video-src/brag-plan.md`) was the base.
- **Moves used** (handout p.7): Rise for titles and captions, Pop for the stat numbers, Checklist
  tick for the intent fields, pipeline steps and the "six things" list, Slide-in for finding cards,
  a slow push-in on every screen. Polished tone: no bounce, no sound.
- **Handout tips applied:** `--crf 23` to keep the file small; all text inside the middle of the
  frame; captions sit in their own bar so no graphic covers them.

### Brag rubric

- **What is it?** Errata checks marketing drafts against an organisation's approved brand rules and
  facts before they ship, and every flag cites the rule or fact it broke.
- **Who is it for?** Marketing creators, their reviewers, and Legal/Accessibility specialists in
  regulated brands (demo: PayWise, a fictional fund app).
- **What's new to show?** The three Round 3 commitments (MCP server, AI check pending, Clarity Score
  on real data) and the extras (cross-modal check, palette auto-heal, publish receipt and
  kill-switch, Clarity backtest).
- **Visual hook:** "Every draft, checked before it ships." with a "What's new in Round 3" tag.
- **Tone:** `polished`, in the site's look: white, 2 px ink outlines, yellow highlights, pink for
  "New", DM Sans, DM Mono for IDs.
- **Share line:** "Errata now keeps working when the AI is busy, cross-checks image, caption and
  landing page, fixes contrast from your own palette, revokes approvals when a fact changes, and
  plugs into Claude or Cursor."

## Where each screen comes from

| Scenes | Source | Data |
|---|---|---|
| Write, findings (CL-03, E-19), Legal sign-off | Captures of the running app from the first video (`apps/web/video-src/capture.mjs`, local Supabase stack, demo roles, 2026-10-28) | Fictional PayWise |
| AI check pending, palette fix, publish receipt and revoked approval, shadow backtest, MCP card | The real components rendered on the dev kitchen sink (`/dev/kitchen-sink`), captured by `apps/web/video-src/capture-r3.mjs` | **Sample data** from `app/dev/kitchen-sink/samples.ts`; each of these scenes is labelled "Component preview · sample data" on screen |
| Cross-check | A graphic of test post `c01-date` from `apps/worker/tests/fixtures/cross_modal_posts.json`; the result line is the real `check_cross_modal` output for that post (E-19, blocker, "the caption matches it") | Fictional PayWise |
| Six check steps, "Six things are new", title and end cards | Motion graphics | — |

### Numbers on screen and where they were measured

| On screen | Measurement | Where |
|---|---|---|
| 20/20, load test: pending runs done, 0 lost | 20 submissions with a simulated 45 s rate limit: 20 pending, 20 completed, 0 lost, 0 failed | Real stack, MacBook Air, 2026-11-01 (`apps/worker/eval/load_report.md`) |
| AI retries after 1, 2, 4, 8 min | `LLM_PENDING_RETRY_DELAYS_S = (60, 120, 240, 480)` | `apps/worker/brandlens_worker/config.py` |
| 10/10 conflicts flagged, 0 false flags | 20 labelled posts (10 conflicting, 10 consistent) | Build sandbox (`test_cross_modal.py`) |
| 18/18 fixable samples fixed on-palette | 20 labelled samples; the 2 pastel-only samples correctly get no fix | Build sandbox (`test_autoheal.py`) |
| 22/22 kill-switch database tests pass | pgTAP | Plain Postgres in the build sandbox; the full 182-test suite later passed on the real stack (2026-11-03) |
| 0 AI calls, local embeddings, last 30 findings | `SHADOW_SAMPLE = 30`; the backtest uses only the worker's embedding model | Code (`heroes/gcs_shadow.py`) |
| 20/20 test calls: only live facts | `make mcp-check`: 20 calls, 3 canaries never returned | Real stack, 2026-10-31 and 2026-11-03 (`apps/worker/eval/mcp_check.md`) |

The projected Clarity numbers (GCS 60 → 74) and the MCP key list are kitchen-sink samples, not
measurements; the video labels them so.

## Storyboard (87 s)

| # | Time | Scene | On screen | Caption (also the WebVTT cue) |
|---|---|---|---|---|
| 1 | 0–4 | Hook | "Every draft, checked before it ships." + "What's new in Round 3" | Errata checks every draft against your approved brand rules and cites the rule behind every flag. |
| 2 | 4–10 | 1 · Write | `01-write.png`: caption text, then the five intent fields ticked | A creator writes a caption and sets its intent: goal, audience, call to action, channel and campaign. |
| 3 | 10–15 | 2 · Check | Six labelled steps tick in order | Six steps run. A flag survives only if it cites an approved rule or fact. |
| 4a | 15–20 | 3 · Findings | CL-03 card, IDs CL-03 and F-112 | CL-03: "assured returns" on a market-linked fund, quoting F-112 without its disclaimer. |
| 4b | 20–25 | 3 · Findings | E-19 card | E-19: Oct 18 at Hall B belongs to another campaign. Caught without AI judgement. |
| 5 | 25–30 | New | "Six things are new." list, ticked one by one | New since Round 2: six features, each one shown next. |
| 6 | 30–37 | New 1/6 | "AI check pending" banner; flow: findings shown now → retries after 1, 2, 4, 8 min → reviewers see it when done; stat 20/20 | If the AI provider is busy, rule-based findings show at once and the AI check retries by itself. |
| 7 | 37–44 | New 2/6 | Image text, caption and vault fact E-19; "Oct 18" outlined red, "Oct 28" green; finding E-19 · Blocker; stat 10/10 | The image says Oct 18, the caption says Oct 28. Fact E-19 says Oct 28, so the image is flagged. |
| 8 | 44–51 | New 3/6 | Palette fix preview (3.54 : 1 → 4.84 : 1, Terracotta); stat 18/18 | Low-contrast text gets the closest colour from your own palette that passes. Nothing changes until a person accepts it. |
| 9 | 51–58 | 4 · Review | Routing line as Legal, then the sign-off dialog | Claims go to Legal, who signs off with a reason. Every decision is audited. |
| 10 | 58–66 | New 4/6 | Publish receipt; flow: fact E-19 changes → approval revoked → needs revision, audited; revoked banner; stat 22/22 | At publish-ready, Errata issues a receipt… / If one of those facts changes or expires, approval is revoked… |
| 11 | 66–73 | New 5/6 | Shadow backtest projection; stat "0 AI calls" | Unclear rules get better examples. A backtest on recent real reviews projects the effect before anyone approves them. |
| 12 | 73–81 | New 6/6 | MCP card and its three tools; stat 20/20 | Claude or Cursor can fetch live campaign facts and pre-check drafts, with a personal read-only key. |
| 13 | 81–87 | End | "Humans approve. Errata never publishes." + wordmark | Humans approve. Errata never publishes. |

## Rebuild

From `apps/web`. The component capture needs the dev server; the kitchen sink needs no database,
so placeholder public values are enough (never real keys):

```bash
pnpm dev
```

```bash
node video-src/capture-r3.mjs
```

If Playwright's own browser isn't installed, point `CHROMIUM_PATH` at an installed Chrome or
Chromium. Then build and render:

```bash
node video-src/round3/build.mjs
```

```bash
cd video-src/round3 && npx hyperframes@0.8.212 render . -o renders/errata-whats-new.mp4 --crf 23
```

The site files come from that render: a web MP4 (smaller, fast start; 7 MB instead of 12 MB with
no visible loss on the UI text), a WebM and the poster:

```bash
ffmpeg -i renders/errata-whats-new.mp4 -c:v libx264 -preset slow -crf 26 -tune stillimage -pix_fmt yuv420p -movflags +faststart -an renders/web.mp4
```

```bash
ffmpeg -i renders/errata-whats-new.mp4 -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -deadline good -cpu-used 4 -pix_fmt yuv420p -an renders/errata-whats-new.webm
```

```bash
ffmpeg -ss 29 -i renders/errata-whats-new.mp4 -frames:v 1 -q:v 3 renders/errata-whats-new-poster.jpg
```

To swap the sample-data scenes for screens of the running app, extend `capture.mjs` against the
local stack (`make dev-local`) and replace the `r3-*.png` shots; the composition doesn't change.
