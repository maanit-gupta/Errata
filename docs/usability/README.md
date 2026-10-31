# Usability evidence (Round 3, improvement 2)

The A/B benchmark (manual guideline check vs Errata), four task-completion tasks and the SUS
survey. Jagpreet runs the sessions (8–15 participants); nothing here is filled in until a real
session happens.

| File | Use |
|---|---|
| [`checklist.md`](checklist.md) | Moderator checklist: the day before, each block, each session, afterwards |
| [`consent.md`](consent.md) | Read out and record consent before each session |
| [`tasks.md`](tasks.md) | Moderator script: A/B conditions, the two captions and their four seeded issues, T1–T4 with exact UI paths |
| [`sus.md`](sus.md) | System Usability Scale questionnaire, with the scoring rule |
| [`sessions.csv`](sessions.csv) | The raw record: one row per participant (order and caption pre-filled for counterbalancing) |
| [`results.md`](results.md) | Generated summary (gates, medians, per participant, SUS) plus hand-written "top issues" |

`python scripts/usability_summary.py` turns `sessions.csv` into `results.md`. It refuses
out-of-range cells instead of guessing, skips rows with no results, and reports **PENDING** until
there is data. The Round 3 gate is: SUS mean ≥ 70, and participants find more of the seeded issues
with Errata than by hand.

Rules: fictional PayWise data only, no names (P1, P2…), and no recordings in the repo.
