# Moderator script

**Before the day:** follow [`checklist.md`](checklist.md). Desktop browser, demo roles. Use a
stopwatch: start when you finish reading the task aloud, stop when the participant says "done" or
the state is visibly reached. Record everything in [`sessions.csv`](sessions.csv) during the session.

UI labels below match the current build (checked against `e2e/core-loop.spec.ts`, 2026-10-31).

## A/B benchmark: manual guideline check vs Errata

Counterbalance with the pre-filled `order` and `a_caption` columns in `sessions.csv`: odd
participants do A then B, even participants B then A, and the caption used for A alternates every
two participants. Each condition uses a **different** caption, so nobody can remember answers.

| Condition | What the participant gets | Task (read aloud) |
|---|---|---|
| **A: manual** | The PayWise guide PDF (`fixtures/paywise/guide.pdf`), `facts.csv` and `glossary.csv` (from `fixtures/paywise/`) | "Find every problem in this caption that breaks the brand guide or the facts, and say which rule each one breaks." |
| **B: Errata** | Signed in as **Creator** (sign-in page → "Try a demo role" → **Creator**) | "Paste this caption into a new draft, check it, and tell me the problems it finds and which rule each one cites." Path: **New draft** → paste → fill the intent fields (Campaign: **Diwali SIP 2026**) → **Submit for check**. |

Captions. Each carries the same four issues, all caught by the deterministic stages, so the results
don't depend on LLM quota (pinned by `test_hero_draft_produces_exactly_the_expected_findings` and
`test_usability_caption_two_has_the_same_four_issues` in `apps/worker/tests/test_pipeline.py`):

| Issue | Rule / fact | Caption 1 | Caption 2 |
|---|---|---|---|
| Brand name casing | G-07 | "Paywise app" | "Pay Wise" |
| Wrong fee | F-048 | "0% exit load" | "0% exit load" |
| Guaranteed-returns claim | CL-03 | "lock in 14.2% assured annual returns" | "enjoy assured returns" |
| Wrong campaign's event (date + venue) | E-19 (E-11 bleed) | "Oct 18 at Hall B, Chandigarh" | "Oct 18 at Hall B, Chandigarh" |

1. **Caption 1:** "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!"
2. **Caption 2:** "Invest on Pay Wise this Diwali with 0% exit load and enjoy assured returns every year. Meet our team on Oct 18 at Hall B, Chandigarh. Register now."

Record per condition (`sessions.csv`):

- `a_time_s` / `b_time_s`: seconds to finish.
- `a_found` / `b_found`: how many of the 4 issues above they named (0–4). In B, an issue counts
  only if the participant *names* it, not just because it's on screen.
- `a_wrong` / `b_wrong`: problems they claimed that aren't real (wrong flags).
- `b_ids_correct`: how many of the 4 they tied to the right rule or fact ID (0–4).

## Task-completion tasks (Errata only)

Continue from the condition-B draft (or caption 1 if they did B first and it's been a while).

| # | Role | Task (read aloud) | Success when | Path in the UI |
|---|---|---|---|---|
| T1 | Creator | "Fix the issues Errata found, except the returns claim: you think Legal should decide that one." | G-07, F-048 and E-19 fixed; CL-03 routed | **Accept fix** on G-07, F-048, E-19; **Route to Legal** on CL-03 |
| T2 | Creator | "Send it back for checking." | State chip shows **Legal review** | **Resubmit for check** |
| T3 | Legal | "Approve it, with a reason." | State shows **Approved**; reason in the Audit tab | Switch role to **Legal** → Review → open the draft → **Sign off** → reason → **Confirm sign-off** |
| T4 | Brand admin | "Find the rule reviewers find unclear, and improve it." | TV-04 shows **v2** | **Insights** → Guideline watchlist → TV-04 (UNCLEAR) → **Review 3 examples** → keep the ones they like → **Approve N examples** |

T4 needs the generated examples to exist (checklist step 4). If they don't, skip T4 and leave its
cell blank rather than marking it failed.

Record per task in `t1`…`t4`: **Y** (completed alone), **H** (completed with help), **N** (not
completed). Put times, errors and any quote worth keeping (anonymised) in `notes`.

After the tasks: hand over [`sus.md`](sus.md) and copy the ten answers into `sus_q1`…`sus_q10`,
then ask: "What was most confusing? What would you change first?" (into `notes`).
