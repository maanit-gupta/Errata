# Moderator script

**Setup:** run `scripts/reset_demo.sh` beforehand. Desktop browser, demo roles. Use a stopwatch; start when you finish reading the task, stop when the participant says "done" or the state is visibly reached.

## A/B benchmark: manual guideline check vs BrandLens

Counterbalance the order: odd participants do A then B; even participants do B then A, with a different caption in each so they can't remember answers.

| Condition | What the participant gets | Task |
|---|---|---|
| **A: manual** | The PayWise guide PDF (`fixtures/paywise/guide.pdf`), `facts.csv` and `glossary.csv` | "Find every problem in this caption that breaks the brand guide or the facts, and say which rule each one breaks." |
| **B: BrandLens** | Signed in as **Creator** | "Paste this caption into a new draft, submit it for a check, and list the problems it finds and which rule each cites." |

Captions (each has the same 4 issues, all caught by the deterministic stages, so the results don't depend on LLM quota: CL-03 claim, F-048 exit load, E-19/E-11 campaign bleed, G-07 casing):

1. *Caption 1 (hero):* "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!"
2. *Caption 2:* "Invest on Pay Wise this Diwali with 0% exit load and enjoy assured returns every year. Meet our team on Oct 18 at Hall B, Chandigarh. Register now."

Record per condition: **time to finish**, **issues found (of 4)**, **wrong issues claimed**, **correct rule IDs cited**.

## Task-completion tasks (BrandLens only)

| # | Role | Task | Success when |
|---|---|---|---|
| T1 | Creator | "Fix the issues BrandLens found, except the claim, which you think Legal should decide." | G-07/F-048/E-19 accepted; CL-03 routed to Legal |
| T2 | Creator | "Send it back for checking." | State shows **Specialist review** |
| T3 | Legal | "Approve it, with a reason." | **Approved**, reason recorded |
| T4 | Brand admin | "Find the rule reviewers find unclear, and improve it." | TV-04 examples approved (version 2) |

Record per task: completed (Y/N/with help), time, errors, and any quote worth keeping (anonymised).

After the tasks: hand over [`sus.md`](sus.md), then ask: "What was most confusing? What would you change first?"
