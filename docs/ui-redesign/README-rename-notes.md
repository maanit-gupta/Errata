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
