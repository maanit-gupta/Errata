# Errata "How it works" video: plan

Built with /brag-slim (the brag plugin's Opus 5.5 path) on HyperFrames, following
`Motion-Graphics-with-Claude-Code.pdf`. The owner's brief overrides the skill defaults: 57 s (not
15–25 s), silent with on-screen captions (no music or SFX), 1920×1080 at 30 fps.

## Answers (brag rubric)

- **What is it?** Errata checks marketing drafts against an organisation's approved brand rules and facts before they are published, and every flag cites the rule or fact it broke.
- **Who is it for?** Marketing creators, their reviewers, and Legal/Accessibility specialists in regulated brands (demo: PayWise, a fictional fund app).
- **What sets it apart?** Citations on every flag; deterministic checks first (facts, dates, terms, contrast) so the most damaging mistakes are caught without AI judgement; humans approve; it never publishes.
- **Most impressive claim:** the context-bleed catch: last campaign's date and venue flagged as E-19 with no AI involved.
- **Visual hook:** "Every draft, checked before it ships." in the site's style, then straight into the real editor.
- **Real UI shown:** draft editor with intent, finding cards, fix block, review page as Legal, sign-off dialog, audit trail, image check. All captured from the running app (`capture.mjs`), real data, demo roles only.
- **Tone:** `polished` (calm, readable, long holds), in the site's look: white, 2px ink outlines, yellow highlights, DM Sans, DM Mono for IDs.
- **Share line:** "Errata checks every draft against your brand rules, cites the rule behind every flag, and leaves the decision to people."

## Truthfulness notes

- The capture ran with placeholder LLM keys (no AI keys on this machine), so the run is degraded: the four text findings and the image finding are all deterministic, which is true of these five findings in any run. The video shows the finding cards, not the degraded banner, and never claims an AI result it didn't produce.
- The CL-03 fix shown is the product's deterministic fix (adds the F-112 disclaimer). AI rewrites are the ones re-checked against the intent at run time; the caption says so without claiming an AI rewrite happened here.
- People are the seeded demo users (Rohan, Creator; Dev, Legal). The sign-off reason is the one the core-loop test uses.

## Storyboard (57 s)

| #   | Time      | Scene        | On screen (real UI)                                                                          | Caption (also the WebVTT cue)                                                                         |
| --- | --------- | ------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | 0.0–4.0   | Hook         | Title card: "Every draft, checked before it ships." + Errata wordmark                        | Errata checks every draft against your approved brand rules.                                          |
| 2   | 4.0–12.0  | 1 · Write    | `01-write.png`: caption text, then the five intent fields ticked one by one                  | A creator writes a caption and sets its intent: goal, audience, call to action, channel and campaign. |
| 3   | 12.0–19.0 | 2 · Check    | Six labelled steps tick in order: Ingest, Protect, Filters, Retrieve, AI pass, Citation gate | Six steps run. A flag survives only if it cites an approved rule or fact.                             |
| 4a  | 19.0–23.5 | 3 · Findings | `card-CL-03.png` header, explanation, cites (CL-03, F-112)                                   | CL-03: "assured returns" on a market-linked fund, quoting F-112 without its disclaimer.               |
| 4b  | 23.5–28.0 | 3 · Findings | `card-E-19.png` explanation + cite                                                           | E-19: Oct 18 at Hall B belongs to another campaign. Caught without AI judgement.                      |
| 4c  | 28.0–32.5 | 3 · Findings | `card-G-07.png`                                                                              | G-07: the brand is written PayWise, not "Paywise app".                                                |
| 4d  | 32.5–37.0 | 3 · Findings | `07-image.png` poster with boxes + `card-WCAG-1.4.3.png`                                     | WCAG 1.4.3: poster text at 2.89 : 1 contrast. Large text needs 3 : 1.                                 |
| 5   | 37.0–43.0 | 4 · Fix      | CL-03 fix block + intent chips (Goal, Audience, CTA)                                         | Fixes keep your intent. AI rewrites are re-checked before you see them.                               |
| 6a  | 43.0–49.0 | 5 · Review   | `04-legal.png` routing line, then `05-signoff.png` dialog                                    | The claim goes to Legal, who signs off with a reason.                                                 |
| 6b  | 49.0–52.0 | 5 · Review   | `06-audit-list.png`, last entries                                                            | The audit trail records who decided, when and why.                                                    |
| 7   | 52.0–57.0 | End          | "Humans approve. Errata never publishes." + wordmark + tagline                               | Humans approve. Errata never publishes.                                                               |

Moves (handout p.7): Rise for frames and captions, Checklist tick for intent fields and pipeline steps, Punch-in/Reframe zooms into the screenshot regions, Slide-in for finding cards. No bounce (polished tone; site rules).

Poster: a settled frame of scene 4a (the CL-03 card with its IDs), baked as frame 0.
