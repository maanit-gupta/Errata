import { describe, expect, it } from "vitest";
import { buildGroundedDraft, PRESETS, type GroundFact } from "@/lib/mcp/grounded";

// Diwali SIP 2026 context as the server loads it: E-11 (other campaign, expired) is never here.
const facts: GroundFact[] = [
  {
    code: "E-19",
    kind: "event",
    statement: "Diwali Wealth Webinar: online only, Oct 28, 7:00 PM IST",
    value: { name: "Diwali Wealth Webinar", date: "2026-10-28", time: "19:00", venue: "online" },
    required_disclaimer: null,
  },
  {
    code: "F-048",
    kind: "fee",
    statement: "1% exit load on redemptions within 365 days",
    value: { exit_load_pct: 1, window_days: 365 },
    required_disclaimer: null,
  },
  {
    code: "F-112",
    kind: "rate",
    statement: "Flexi-Cap 3-yr historical CAGR is 14.2% as of Q3 2026",
    value: { scheme: "Flexi-Cap", cagr_3y_pct: 14.2, as_of: "Q3 2026", historical: true },
    required_disclaimer:
      "Mutual Fund investments are subject to market risks, read all scheme related documents carefully.",
  },
];
const rules = [
  { code: "CL-03", title: "No guaranteed or assured returns", summary: "Never promise returns." },
  { code: "TV-02", title: "Warm, plain-spoken, confident; no hype", summary: null },
];
const canaries = [{ code: "F-999", text: "Internal margin is 3.1% on Flexi-Cap" }];
const run = (i: number) =>
  buildGroundedDraft({
    prompt: PRESETS[i].prompt,
    campaignName: "Diwali SIP 2026",
    facts,
    rules,
    canaries,
  });

describe("buildGroundedDraft", () => {
  it("webinar preset cites E-19 and keeps Hall B / Oct 18 out", () => {
    const r = run(0);
    expect(r.factIds).toEqual(["E-19"]);
    expect(r.text).toContain("Oct 28");
    expect(r.text).toContain("7:00 PM IST");
    expect(r.text).not.toMatch(/Hall B|Oct 18/);
    expect(r.intent.channel).toBe("instagram_caption");
  });

  it("returns preset injects F-112 CAGR, the exit load and the SEBI disclaimer", () => {
    const r = run(1);
    expect(r.factIds).toEqual(["F-048", "F-112"]);
    expect(r.text).toContain("14.2%");
    expect(r.text).toContain("subject to market risks");
    expect(r.text).not.toMatch(/guarantee/i);
    expect(r.ruleIds[0]).toBe("CL-03");
    expect(r.intent.channel).toBe("linkedin_post");
  });

  it("reports never-send canaries as counted and not leaked", () => {
    const r = run(1);
    expect(r.canaries).toBe(1);
    expect(r.leaked).toBe(0);
  });
});
