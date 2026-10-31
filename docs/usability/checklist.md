# Moderator checklist (one page; print it)

Fictional PayWise data only. No names: participants are P1, P2… (pre-filled in `sessions.csv`).

**Day before**
- [ ] Pick one target for every session: the live app (after the merge) or the local stack (`make dev-local`).
- [ ] Recruit 8–15 people (marketing/content people and students).
- [ ] Print per person: [`consent.md`](consent.md), [`sus.md`](sus.md). Print once: the two captions in [`tasks.md`](tasks.md) (separate sheets), the condition-A packet (`fixtures/paywise/guide.pdf`, `facts.csv`, `glossary.csv`) and [`ai-pending-banner.png`](ai-pending-banner.png).
- [ ] Stopwatch ready; `docs/usability/sessions.csv` open.

**Before each block (once a day)**
1. [ ] Reset the demo: `scripts/reset_demo.sh <SUPABASE_URL> --yes` (cloud) or `make db-reset && make seed-assets-local` (local). This re-runs the simulated month, which T4 and T6 need.
2. [ ] Wake the worker: `<worker-url>/healthz` returns `{"status":"ok"}` (the free tier can take ~60 s).
3. [ ] Dry-run caption 1 as **Creator**: G-07, F-048, CL-03 and E-19 all appear. An "AI check pending" or degraded banner is fine; all four are rule-based.
4. [ ] As **Brand admin**: Insights shows TV-04 **UNCLEAR** with **Review 3 examples**, and the **All data / Real reviews only** filter. No examples button → LLM quota is out → skip T4 today (leave `t4` blank).
5. [ ] Settings → **AI tools (MCP)** shows **Connect Claude or Cursor** (T5).
6. [ ] Delete the dry-run draft and any test MCP keys, or reset again.

**Each session (~20 min)**
1. [ ] Read the consent note; no consent, no session. Write `Y` in `consent`, plus `date` and a one-phrase `background` (no names or employers).
2. [ ] A and B in the row's `order`; caption `a_caption` for A, the other for B. No help during A/B. Record times and counts straight away.
3. [ ] T1–T6. Help only after a minute stuck, and mark **H** when you do.
4. [ ] Probe: show the banner print, ask the question in `tasks.md`, record `pending_understood` and their words.
5. [ ] SUS on paper, copy the ten answers; ask the two closing questions into `notes`.
6. [ ] Reset if the next person would see this person's draft or key.

**After**
- [ ] `python scripts/usability_summary.py` → updates `results.md`. Fill "Top issues" by hand.
- [ ] Delete screen recordings once tabulated (promised in the consent note).
- [ ] Copy only the script's numbers into the README and `docs/REPORT.md`.
