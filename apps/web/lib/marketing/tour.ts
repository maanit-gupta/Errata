/**
 * Landing-page product tour: scene timing and the text equivalent of every scene.
 *
 * The visuals in components/marketing/product-tour are decorative (aria-hidden); `summary` is what
 * screen readers get and what the visible caption shows, so it must say everything the scene shows.
 * Every number here is sourced (README, docs/REPORT.md, docs/plan.pdf, fixtures/paywise) or the
 * scene is marked illustrative. Hex values live here, not in .tsx (ESLint bans hex in .tsx).
 */

export type TourRole = "Brand admin" | "Creator" | "Agency" | "Manager" | "Legal" | "Accessibility";

export const DEMO_ROLES: TourRole[] = [
  "Brand admin",
  "Creator",
  "Agency",
  "Manager",
  "Legal",
  "Accessibility",
];

export type TourScene = {
  id: string;
  /** Short title on the timeline and the caption. */
  title: string;
  /** The live stage badge. */
  stage: string;
  durationMs: number;
  /** Role shown in the demo strip, or null when the scene isn't inside the app. */
  role: TourRole | null;
  /** True when the scene's numbers are illustrative demo data, not measurements. */
  illustrative?: boolean;
  /** Full text equivalent of the scene (caption and screen readers). */
  summary: string;
};

export const TOUR_SCENES: TourScene[] = [
  {
    id: "problem",
    title: "The problem",
    stage: "Why",
    durationMs: 6000,
    role: null,
    summary:
      "Errata, formerly BrandLens: every draft, checked before it ships. Drafts now come from employees, agencies, AI writing tools and regional teams, and a manual glance reads only the wording: 3–4 review rounds and 72–96 hours per post in our interviews, against a target of about 2 hours and 1–2 rounds. 77% of respondents see off-brand content at their company (Marq, 2021). 98% of ads ASCI scrutinised in FY 2024–25 needed a change. 70%+ of CMOs worry about GenAI's effect on brand voice (BCG, 2024). 79.1% of the top million home pages have low-contrast text (WebAIM Million, 2025).",
  },
  {
    id: "setup",
    title: "Set up the vault",
    stage: "Set up",
    durationMs: 7000,
    role: "Brand admin",
    summary:
      "Sign in with one click as any of six demo roles; the pink demo strip switches roles without signing out. As Brand admin, import the PayWise brand guide (PDF, Word or a web page) and a Fact Vault CSV. AI drafts rule cards such as TV-02, CL-03 and G-07, and none is used until a person approves it. The read-only MCP server at /v1/mcp gives Claude Code and Cursor only approved, unexpired rules and facts for a campaign, with a personal key: 20 of 20 real-stack calls passed and 0 of 3 never-send canaries leaked.",
  },
  {
    id: "draft",
    title: "Draft with intent",
    stage: "Draft",
    durationMs: 7000,
    role: "Creator",
    summary:
      "As Creator, the draft states its intent before it can be checked: goal “webinar sign-ups”, audience “first-time investors”, call to action “Register now”, plus channel and campaign. Drafts can be plain text, Markdown, HTML, Word, images or PDF decks. Version 2 of the Instagram caption for Diwali SIP 2026 reads: “This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!” The creator submits it for a check.",
  },
  {
    id: "pipeline",
    title: "Six-step check",
    stage: "Check",
    durationMs: 7000,
    role: "Creator",
    summary:
      "Six steps run. Inside the worker, locally and reproducibly: 1 Ingest the text and boxes, 2 Protect by redacting personal data and never-send vault items, 3 Filters with no AI (glossary, campaign-scoped Fact Vault, claims lexicon, WCAG contrast, colour distance and logo checks), 4 Retrieve the closest approved rules and facts with a local embedding model. Then 5 one structured AI call judges tone and claims and drafts fixes, and 6 the citation gate drops any flag whose rule or fact wasn't retrieved or whose quote isn't in the draft. Each suggested fix is checked locally: meaning kept (cosine of at least 0.74), call to action kept, and re-run through the filters. A warm local embedding takes about 4.8 ms.",
  },
  {
    id: "findings",
    title: "Cited findings",
    stage: "Findings",
    durationMs: 9000,
    role: "Creator",
    summary:
      "Four findings, each citing its source. Blocker, CL-03 and F-112, confidence 0.96: “14.2% assured annual returns” presents a historical figure as a guarantee; the fix states the 3-year historical CAGR as of Q3 2026 with the mutual fund disclaimer, and the creator routes it to Legal. Blocker, F-048 and E-19, deterministic: “0% exit load” and “Oct 18 at Hall B” conflict with this campaign's facts (1% exit load within 365 days; online webinar on Oct 28, 7:00 PM IST); the creator accepts the fix. Warning, G-07: write “PayWise”, not “Paywise app”; fix accepted. Warning, WCAG 1.4.3: poster text at 2.89 : 1. Visual auto-heal offers the nearest approved palette colour, Vermilion #D63A24 at 4.68 : 1 on white, in place of #E8624A at 3.35 : 1, with a Copy CSS fix button; the creator decides. The cross-modal check compares dates, times and percentages across the image text, the caption and the landing page against the same vault fact. Findings below 0.6 confidence can't be accepted in one click, and dismissing needs a reason.",
  },
  {
    id: "review",
    title: "Route and sign off",
    stage: "Review",
    durationMs: 8000,
    role: "Legal",
    summary:
      "Routing follows risk: the claims finding on CL-03 sends version 3 straight to Legal review, skipping the manager queue. As Legal, the reviewer reads the immutable diff from v2 to v3, the citations CL-03 and F-112 and a comment thread, then signs off with a reason: “Disclaimer added”. Content moves through eight states, from Draft to Publish-ready, only through one database function that logs every change. Publish-ready content gets a receipt: a SHA-256 hash of the approved text and the facts it relies on, with an expiry countdown. When a brand admin edits a fact it relies on, or the fact expires (checked every 60 seconds), the kill-switch sends the content back to Needs revision, live.",
  },
  {
    id: "insights",
    title: "Clarity insights",
    stage: "Insights",
    durationMs: 7000,
    role: "Brand admin",
    illustrative: true,
    summary:
      "Illustrative data. As Brand admin, Insights scores every rule with the Guideline Clarity Score: GCS = 100 × (1 − [0.45 × dismissal rate + 0.35 × reviewer override rate + 0.20 × low-confidence rate]). Below 65 a rule is Unclear and Errata drafts three do and don't examples; 65 to 75 is Watch. Example: TV-04 “Playful, not flippant” scores 60 (Unclear), VS-02 image warmth 73 (Watch), CL-03 97 and G-07 99 (Clear). Before the admin approves the examples, the shadow backtest replays the last 30 TV-04 findings: projected dismissals fall from 42% to 8%, override and low-confidence rates are held, and the projected GCS rises from 60 to 75.",
  },
  {
    id: "proof",
    title: "Measured, not claimed",
    stage: "Proof",
    durationMs: 6000,
    role: null,
    summary:
      "Measured results. 100% of shown findings cite a rule or fact, 0 uncited. Blocker recall 1.00 on 32 labelled blockers, overall precision 0.96 on 60 golden drafts. Non-AI P95 of 8.46 s under load, 0 lost jobs, 20 of 20 pending runs completed. About 4.8 ms per warm local embedding. 330 worker tests, 196 web tests and 182 database tests passing on 3 Nov 2026. Errata: pre-publication checks with cited rules. Humans approve; Errata never publishes.",
  },
];

export const TOUR_TOTAL_MS = TOUR_SCENES.reduce((sum, s) => sum + s.durationMs, 0);

/** Start of scene `index` on the tour clock, in ms. Clamped to the valid range. */
export function sceneStart(index: number): number {
  const i = Math.max(0, Math.min(TOUR_SCENES.length - 1, Math.trunc(index)));
  let start = 0;
  for (let k = 0; k < i; k++) start += TOUR_SCENES[k].durationMs;
  return start;
}

/**
 * Which scene is on screen at `elapsed` ms, and how far into it (`local` ms). At or past the end,
 * the last scene is returned fully played (`local` = its duration).
 */
export function sceneAt(elapsed: number): { index: number; local: number; progress: number } {
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  let start = 0;
  for (let i = 0; i < TOUR_SCENES.length; i++) {
    const d = TOUR_SCENES[i].durationMs;
    if (t < start + d) return { index: i, local: t - start, progress: (t - start) / d };
    start += d;
  }
  const last = TOUR_SCENES.length - 1;
  return { index: last, local: TOUR_SCENES[last].durationMs, progress: 1 };
}

/** Fill of timeline segment `index` (0..1) at `elapsed`. */
export function segmentFill(index: number, elapsed: number): number {
  const start = sceneStart(index);
  const d = TOUR_SCENES[index]?.durationMs ?? 1;
  return Math.max(0, Math.min(1, (elapsed - start) / d));
}

/** `m:ss` for the time readout. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Visual auto-heal example (scene 5). Ratios are WCAG 2.x on white, checked in tour.test.ts. */
export const AUTO_HEAL = {
  flagged: { hex: "#E8624A", ratio: "3.35" },
  palette: { name: "Vermilion", hex: "#D63A24", ratio: "4.68" },
  onHex: "#FFFFFF",
} as const;
