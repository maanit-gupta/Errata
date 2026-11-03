import { describe, expect, it } from "vitest";
import { cssPatch, parseVisualFix } from "@/lib/drafts/visual-fix";

const OK = {
  original_text_hex: "#888888",
  original_bg_hex: "#FFFFFF",
  original_ratio: 3.54,
  healed_text_hex: "#B5562F",
  healed_text_name: "Terracotta",
  healed_bg_hex: "#FFFFFF",
  healed_bg_name: null,
  healed_ratio: 4.84,
  required_ratio: 4.5,
  strategy: "text",
  source: "palette",
  applied: false,
};

describe("parseVisualFix (Hero 3)", () => {
  it("accepts the worker's shape", () => {
    expect(parseVisualFix(OK)?.healed_text_hex).toBe("#B5562F");
  });
  it("rejects anything that isn't a strict #RRGGBB (it becomes an inline style)", () => {
    expect(parseVisualFix({ ...OK, healed_text_hex: "red" })).toBeNull();
    expect(parseVisualFix({ ...OK, healed_bg_hex: "#fff; background:url(x)" })).toBeNull();
    expect(parseVisualFix({ ...OK, healed_bg_hex: "#ffffff" })).toBeNull();
  });
  it("rejects non-palette sources and missing data", () => {
    expect(parseVisualFix({ ...OK, source: "model" })).toBeNull();
    expect(parseVisualFix(null)).toBeNull();
    expect(parseVisualFix({})).toBeNull();
  });
});

describe("cssPatch (Hero 3 copy button)", () => {
  it("gives paste-ready declarations from the validated palette colours", () => {
    const fix = parseVisualFix(OK)!;
    expect(cssPatch(fix)).toBe(
      [
        "/* Errata palette fix, WCAG 1.4.3: 4.84 : 1 (needs 4.5 : 1) */",
        "color: #B5562F; /* Terracotta */",
        "background-color: #FFFFFF;",
      ].join("\n"),
    );
  });
});
