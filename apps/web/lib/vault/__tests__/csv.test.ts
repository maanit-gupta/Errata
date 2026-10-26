import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, parseFactsCsv, parseGlossaryCsv } from "../csv";

const KIT = join(__dirname, "../../../../../fixtures/paywise");
const CAMPAIGNS = [
  { id: "diwali-id", name: "Diwali SIP 2026" },
  { id: "navratri-id", name: "Navratri Savings 2026" },
];

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas and newlines, CRLF and BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n\r\n')).toEqual([
      ["a", "b"],
      ['x, "y"', "line1\nline2"],
    ]);
  });
});

describe("parseFactsCsv", () => {
  it("parses the PayWise facts.csv fixture", () => {
    const { rows, errors } = parseFactsCsv(readFileSync(join(KIT, "facts.csv"), "utf8"), CAMPAIGNS);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.code)).toEqual(["F-048", "F-112", "E-19", "E-11"]);
    const f112 = rows[1];
    expect(f112.campaign_id).toBe("diwali-id");
    expect(f112.value).toMatchObject({ cagr_3y_pct: 14.2, historical: true });
    expect(f112.required_disclaimer).toMatch(
      /^Mutual Fund investments are subject to market risks/,
    );
    expect(rows[0]).toMatchObject({ campaign_id: null, never_send: false, valid_until: null });
    expect(rows[3].campaign_id).toBe("navratri-id");
  });

  it("reports row errors with line numbers and keeps valid rows", () => {
    const csv = [
      "code,campaign,kind,statement,value_json,required_disclaimer,valid_until,never_send",
      "F-1,,fee,ok,{},,,false",
      "bad,,fee,x,{},,,false",
      "F-2,Unknown Campaign,fee,x,{},,,false",
      'F-3,,fee,x,"[1,2]",,,false',
      "F-4,,banana,x,{},,,false",
      "F-5,,fee,x,{},,2026-13-01,false",
      "F-1,,fee,dup,{},,,false",
    ].join("\n");
    const { rows, errors } = parseFactsCsv(csv, CAMPAIGNS);
    expect(rows.map((r) => r.code)).toEqual(["F-1", "F-1"]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(errors[1].message).toContain('campaign "Unknown Campaign"');
    expect(errors[2].message).toContain("JSON object");
    expect(errors[5].message).toContain("already appears on line 2");
  });

  it("rejects a file missing required columns", () => {
    expect(parseFactsCsv("code,statement\nF-1,x", CAMPAIGNS).errors[0].message).toContain(
      "missing column(s): campaign, kind",
    );
  });
});

describe("parseGlossaryCsv", () => {
  it("parses the PayWise glossary.csv fixture", () => {
    const { rows, errors } = parseGlossaryCsv(readFileSync(join(KIT, "glossary.csv"), "utf8"));
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        code: "G-07",
        preferred: "PayWise",
        variants: ["Paywise", "paywise", "PAYWISE", "Pay Wise", "Paywise app", "PayWise app"],
        banned: false,
        case_sensitive: true,
        note: 'Always camel-cased "PayWise". Never "Paywise app": PayWise is the brand, not just an app.',
      },
    ]);
  });

  it("accepts the documented header spelling variants(|-separated)", () => {
    const { rows } = parseGlossaryCsv(
      "code,preferred,variants(|-separated),banned,case_sensitive,note\nG-1,SIP,sip|Sip,,,\n",
    );
    expect(rows[0]).toMatchObject({
      variants: ["sip", "Sip"],
      banned: false,
      case_sensitive: true,
      note: null,
    });
  });
});
