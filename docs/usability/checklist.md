# Moderator checklist

Print this. Tick each box. Everything here uses the fictional PayWise demo only.

## The day before

- [ ] Decide where you'll run sessions: the **live app** (https://brandlens-app.vercel.app) or the
      local stack (`make dev-local`). Use the same one for every participant.
- [ ] Recruit 8–15 people. Aim for a mix of marketing/content people and students. Never record
      names: participants are P1, P2… (pre-filled in `sessions.csv`).
- [ ] Print: `consent.md` (one per person), `sus.md` (one per person), the two captions from
      `tasks.md` (on separate sheets), and the condition-A packet: `fixtures/paywise/guide.pdf`,
      `facts.csv`, `glossary.csv`.
- [ ] Have a stopwatch (phone is fine) and this repo open on `docs/usability/sessions.csv`.

## Before each block of sessions (once per day)

1. [ ] Reset the demo: `scripts/reset_demo.sh <SUPABASE_URL> --yes` (cloud) or
       `make db-reset && make seed-assets-local` (local). This also re-runs the simulated month.
2. [ ] Wake the worker: open `<worker-url>/healthz` and wait for `{"status":"ok"}` (the free tier
       sleeps; the first check can take ~60 s).
3. [ ] Dry-run caption 1 as **Creator**: all four findings (G-07, F-048, CL-03, E-19) appear. If a
       "degraded" banner shows, that's fine: all four are deterministic.
4. [ ] For T4: sign in as **Brand admin** → Insights → TV-04 shows **UNCLEAR** and a
       **Review 3 examples** button. If there's no button after a few minutes, the LLM quota is
       out: skip T4 today (leave `t4` blank).
5. [ ] Delete the dry-run draft so participants start from an empty Drafts list (or reset again).

## Each session (~20 minutes)

1. [ ] Read the consent note aloud; tick consent and recording in `consent.md`; put `Y` in the
       `consent` column. No consent → no session.
2. [ ] Note `date` and a one-phrase `background` (e.g. "content marketer", "CS student"). No names,
       no employers.
3. [ ] Run A and B in the row's `order`, with caption `a_caption` for A and the other for B.
       Don't help during A or B. Record times and counts straight into the CSV.
4. [ ] Run T1–T4. Help only when they're stuck for more than a minute, and mark **H** if you do.
5. [ ] SUS on paper, then copy the ten answers. Ask the two closing questions.
6. [ ] Reset between participants if the next one would see the previous draft (step 5 above).

## After the sessions

- [ ] `python scripts/usability_summary.py` → updates `results.md` (gates, medians, SUS).
- [ ] Fill in "Top issues and what we changed" in `results.md` by hand.
- [ ] Delete screen recordings once the numbers are in (we promised this in the consent note).
- [ ] Copy the gate results into the README Results section. Report only what the script printed.
