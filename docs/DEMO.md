# BrandLens demo script (3–4 minutes)

Follows the Round 1 storyboard (plan p.10, frames F01–F06): one PayWise Diwali SIP caption, from the brand vault to a rule rewrite. All data is fictional.

**Live app:** https://brandlens-app.vercel.app · **Roles:** the "Try a demo role" panel on the login page, or the **Switch demo role** menu in the header once signed in (no passwords needed in demo mode).

## Before the session (T−30 min)

1. Reset the demo org: `scripts/reset_demo.sh https://<ref>.supabase.co --yes`. It clears every draft, rolls rule cards back to v1, re-seeds and re-simulates 30 days of history, so `/insights` shows **TV-04 UNCLEAR** with 3 suggested examples waiting.
2. Wake the worker: open `https://brandlens-worker.onrender.com/healthz` (free tier sleeps after 15 minutes idle; the first request takes about 30 s).
3. Do a full dry run (F01–F06) and screen-record it as the fallback. A finished F03 run proves the LLM quota is available. Then run the reset again so the live run starts clean.
4. Keep this page and the fallback section open in a second tab.

**Hero caption** (copy exactly):

```
This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!
```

## Script

| # | Frame | Role | Clicks | Say |
|---|---|---|---|---|
| 0 | Hook | — | Login page. | "Every flag BrandLens raises cites the rule or fact it was checked against, and humans approve. Here is one Diwali post, end to end." |
| 1 | **F01 Set up** (30 s) | Brand admin | **Brand admin** → **Vault** → **Rules**. Open **CL-03** (body, source page, examples). Then the **Facts** tab: **F-048** (exit load), **E-19** (the Diwali webinar: online, Oct 28) and **E-11** (the Navratri event, *scoped to its own campaign*). | "The guide became rule cards. AI drafted them, an admin approved each one, and they're versioned. Facts are scoped to campaigns." *(Optional, if quota allows: **Guides** → **Upload a PDF or DOCX** → `fixtures/paywise/guide.pdf` → **Add guide**; drafts appear under **Rules → draft** → **Approve selected**.)* |
| 2 | **F02 Draft** (30 s) | Creator | **Switch demo role → Creator → Switch**. **Drafts** → Title "Diwali SIP launch", Channel *Instagram caption*, Campaign *Diwali SIP 2026* → **New draft**. Paste the hero caption into **Draft text**. Intent: **Goal** "webinar sign-ups", **Audience** "first-time investors", **Call to action** "Register now". **Submit for check**. | "The creator states intent: goal, audience and call to action. The review is judged against it, and any rewrite has to keep it." |
| 3 | **F03 Pre-check** (45 s) | Creator | Findings stream in (about 5–15 s): **CL-03 · BLOCKER** "assured annual returns", **F-048 · BLOCKER** "0% exit load", **E-19 · BLOCKER** "Oct 18 at Hall B, Chandigarh" (the Navratri event's date and venue bleeding into the Diwali post), **G-07 · WARNING** "Paywise app". Click a rule ID to open its card. **Accept fix** on G-07, F-048 and E-19. | "Deterministic checks run first: glossary, fact vault, campaign bleed. The LLM only judges what needs judgement, and anything it can't cite is dropped. Blockers can't be one-click dismissed." |
| 4 | **F04 Route** (20 s) | Creator | On the CL-03 card: **Route to Legal**. Then **Resubmit for check**. State becomes **Specialist review**. | "A claim stays, so it goes to Legal. That's a recorded routing decision, not a Slack message." |
| 5 | **F05 Review** (45 s) | Legal | **Switch demo role → Legal → Switch**. **Review queue** → open the draft. Show **What changed** (diff), "Routed CL-03 → Legal", and **Findings these changes resolved**. **Reason (required)**: "Historical figure is dated; disclaimer added in the creative." **Sign off** → **Approved**. Then **Switch → Manager** → open it → **Mark publish-ready**. | "Every decision needs a reason and lands in the audit log. BrandLens never publishes. Publish-ready is a human approval." |
| 6 | **F06 Learn** (40 s) | Brand admin | **Switch → Brand admin** → **Insights**. The "Illustrative data" pill (30 simulated days). Guideline watchlist: **TV-04 · UNCLEAR (GCS 60)**. **Review 3 examples** → untick one → **Approve 2 examples** → "Added 2 examples to TV-04 as version 2". | "When reviewers keep dismissing a rule, the rule is the problem. BrandLens flags it and drafts examples, and the admin approves them as a new rule version." |
| 7 | Close (10 s) | — | (Optional) **Settings → Services and AI use**. | "Groq first, Gemini as fallback, both on free tiers, with fictional data. Precision is gated in CI at 85% per dimension." |

## Fallback plan

| Problem | What to do |
|---|---|
| **LLM rate-limited** (the run shows the banner "The AI check was unavailable, so only deterministic checks ran") | Keep going. CL-03, F-048, E-19 and G-07 are all **deterministic**, so F03–F05 still work. Say: "Degraded mode: the free-tier LLM is rate-limited, so you see the deterministic findings, flagged as such. Nothing uncited is ever shown." The eval cache (`apps/worker/eval/cache/`) shows the LLM pass on the same hero draft in `apps/worker/eval/report.md`. |
| Worker asleep (findings don't appear after 30 s) | Open `/healthz` on the worker URL, wait for `{"status":"ok"}`, then **Resubmit for check**. The queued job runs as soon as the worker is up. |
| Insights show no UNCLEAR rule | `scripts/reset_demo.sh` was skipped or the examples were already approved. Run it (about 1 minute), then reload `/insights`. |
| Something else breaks live | Switch to the screen recording of the dry run (record it in step 3 of "Before the session"). Say what failed. |

## Timing

F01 0:30 · F02 1:00 · F03 1:45 · F04 2:05 · F05 2:50 · F06 3:30 · close 3:40.
