# README.md changes for the rename to Errata

`README.md` has an unrelated working-tree change, so it was not edited. Apply these line changes by hand. Each "before" line is the current text (line numbers from 2026-10-28).

## Change

| Line | Before | After |
|---|---|---|
| 1 | `# BrandLens` | `# Errata` |
| 3 | `**Pre-publication brand governance.** Every draft (text, doc, image, PDF) is checked …` | `**Pre-publication checks with cited rules.** Every draft (text, doc, image, PDF) is checked …` (rest of the line unchanged) |
| 11 | `## The problem, and what BrandLens does` | `## The problem, and what Errata does` |
| 15 | `BrandLens turns the guide into **rule cards** …` | `Errata turns the guide into **rule cards** …` |
| 70 | `… (manual guideline check vs BrandLens) …` | `… (manual guideline check vs Errata) …` |
| 117 | `… so BrandLens can run next to another local Supabase project.` | `… so Errata can run next to another local Supabase project.` |

Add one line under the title block (after line 9):

> Errata was called BrandLens until 2026-10-28. Repo, package, service and project names still use `brandlens`.

## Keep as they are (real identifiers)

| Line | Text | Why |
|---|---|---|
| 7, 95 | `https://brandlens-app.vercel.app` | Live URL; it doesn't change with the name |
| 95 | Vercel project `brandlens`, Render service `brandlens-worker`, `https://brandlens-worker.onrender.com` | Hosting project and service names |
| 97 | Supabase project `BrandLens` | Cloud project name |
| 100 | `render.yaml` defines `brandlens-worker` | Blueprint service name |
| any | `brandlens_worker`, `@brandlens/web`, `supabase_db_brandlens` | Package and container names |

## Repo rename (2026-10-29)

The GitHub repo moved from `maanit-gupta/BrandLens` to **https://github.com/maanit-gupta/Errata**. The README has no GitHub URL and no clone command today, so only these lines change. Line numbers are from the committed README (`git show HEAD:README.md`).

### Change

| Where | Before | After |
|---|---|---|
| The note suggested above, under the title block | ``> Errata was called BrandLens until 2026-10-28. Repo, package, service and project names still use `brandlens`.`` | ``> Errata was called BrandLens until 2026-10-28. The code lives at https://github.com/maanit-gupta/Errata; package, service and project names still use `brandlens`.`` |
| Quick start code block (line 76, before `make setup   # pnpm install + uv sync`) | none | Add two lines: `git clone https://github.com/maanit-gupta/Errata.git` and `cd Errata` |

### Keep as they are

| Line | Text | Why |
|---|---|---|
| 7 | `**Live app:** https://brandlens-app.vercel.app` | The live-app link stays: the Vercel hostname didn't change with the repo |
| 95 | `https://brandlens-app.vercel.app` (Vercel project `brandlens`), `https://brandlens-worker.onrender.com` (Render service `brandlens-worker`) | Hosting names are separate from the repo name. Renaming them is a separate task |
| 100 | `Render Dashboard → New → Blueprint → select this repo` | "This repo" is still correct: it is now `maanit-gupta/Errata` |
| 102 | `the GitHub repo variable WORKER_URL` | Repo variables move with the repo on a rename |

## Applied (2026-10-29)

The owner asked for the README to be updated, so the changes above are now in `README.md` (plus the redesign, the demo video, the local-stack options and a "Names that still say brandlens" section). This file stays as the record of why each line changed.
