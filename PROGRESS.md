# BrandLens — PROGRESS

> This is the memory between `/clear`s. Claude reads it first in every session and rewrites **Handoff** at the end of every phase.

**Current phase:** P00 (in progress)
**Build window:** Day 1 = `YYYY-MM-DD` (fill in). Milestones: Day 7 core loop · Day 11 feature complete · Day 14 submit.

## Phase status

Status values: `todo` · `in-progress` · `partial` · `done` · `blocked`

| ID | Phase | Owner | Status | Owner/Session | Branch | Notes |
|---|---|---|---|---|---|---|
| P00 | Repo bootstrap & tooling | M | in-progress | M (Claude) | phase/P00-bootstrap | |
| P01 | DB schema, RLS, queue, seed | M | todo | | | |
| P02 | Web shell, auth, demo switcher | J | todo | | | |
| P03 | Worker core | M | todo | | | |
| P04 | Vault ingestion & PayWise kit | M | todo | | | |
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

_Nothing built yet. The env files are filled in at `apps/web/.env.local` and `apps/worker/.env` (do not read their values). Start with P00._

**Template for this section:**
- **Phase / status:**
- **What exists now:** key files, endpoints, tables
- **Stubbed or deferred:**
- **How to run / verify:**
- **Gotchas discovered:**
- **Exact next step:**

## Decisions log (append-only)

| Date | Phase | Decision | Why |
|---|---|---|---|
| 2026-10-26 | pre | Groq primary, Gemini fallback (free tiers) | No paid LLM budget |
| 2026-10-26 | pre | Email/password auth + demo role switcher; no OAuth | Simpler; judge-friendly |
| 2026-10-26 | pre | Discord webhook instead of Slack | Team preference |
| 2026-10-26 | pre | Langfuse Cloud instead of self-hosted | Dev speed; demo data is fictional |
| 2026-10-26 | pre | Next.js 16 instead of 15 | Current stable |
| 2026-10-26 | pre | Second LLM sample only for blocker findings | Resolves the plan's one-call vs two-sample contradiction |

**Dependencies and licences** (append when adding any dependency):

| Package | Licence | Added in |
|---|---|---|
| PyMuPDF | AGPL-3.0 | P00 |

## Open questions (ask the user; don't guess)

- [ ] Build window Day-1 date?
- [ ] Worker host: Railway or Fly? (Needed by P10.)
- [ ] Does the Supabase cloud project already exist (Mumbai)? Is its URL in the env files?
- [ ] Is Resend email wanted, or Discord only?

## Known issues / debt

_none yet_

## Round 2 feedback (paste judges' feedback here when received)

_none yet_
