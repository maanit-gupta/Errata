import { Schema, type Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import {
  cpToUtf16,
  docToText,
  posToTextOffset,
  spanToRange,
  textOffsetToPos,
  textToDocJSON,
  utf16ToCp,
} from "../offsets";

// Minimal schema mirroring what StarterKit gives us: paragraphs, text, hard breaks, bold.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true },
  },
  marks: { bold: {} },
});

const fromText = (text: string): PMNode => schema.nodeFromJSON(textToDocJSON(text));

const HERO =
  "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!";

// Spans exactly as the worker persisted them for the hero draft (P06/P07 acceptance run).
const HERO_SPANS = [
  { start: 36, end: 47, quote: "Paywise app" },
  { start: 53, end: 65, quote: "0% exit load" },
  { start: 70, end: 106, quote: "lock in 14.2% assured annual returns" },
  { start: 137, end: 165, quote: "Oct 18 at Hall B, Chandigarh" },
];

describe("text ↔ doc round trip", () => {
  it.each(["", "one line", "two\nlines", "gap\n\nbetween", "trailing\n"])("%j", (text) => {
    expect(docToText(fromText(text))).toBe(text);
  });
});

describe("offset mapping", () => {
  it("lands hero findings on the exact characters", () => {
    const doc = fromText(HERO);
    for (const s of HERO_SPANS) {
      const { from, to } = spanToRange(doc, HERO, s);
      expect(doc.textBetween(from, to)).toBe(s.quote);
    }
  });

  it("maps across paragraphs (separator counted once)", () => {
    const text = "First para.\nSecond para has PayWise.";
    const doc = fromText(text);
    const start = text.indexOf("PayWise");
    const from = textOffsetToPos(doc, start);
    expect(doc.textBetween(from, from + 7)).toBe("PayWise");
    expect(posToTextOffset(doc, from)).toBe(start);
  });

  it("ignores marks when counting", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Start on " },
            { type: "text", text: "Paywise", marks: [{ type: "bold" }] },
            { type: "text", text: " app" },
          ],
        },
      ],
    });
    const text = docToText(doc);
    const from = textOffsetToPos(doc, text.indexOf("Paywise app"));
    expect(doc.textBetween(from, from + "Paywise app".length)).toBe("Paywise app");
  });

  it("treats hard breaks as newlines", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            { type: "hardBreak" },
            { type: "text", text: "bc" },
          ],
        },
      ],
    });
    expect(docToText(doc)).toBe("a\nbc");
    expect(doc.textBetween(textOffsetToPos(doc, 2), textOffsetToPos(doc, 4))).toBe("bc");
  });

  it("converts Python code-point spans with emoji and multibyte text", () => {
    const text = "🎉 Diwali 🪔 offer: PayWise ₹499";
    const doc = fromText(text);
    // Python: text.index("PayWise") counts each emoji as one code point.
    const cpStart =
      Array.from(text).join("").length &&
      Array.from(text).findIndex((_, i, a) => a.slice(i, i + 7).join("") === "PayWise");
    const range = spanToRange(doc, text, { start: cpStart, end: cpStart + 7 });
    expect(doc.textBetween(range.from, range.to)).toBe("PayWise");
    expect(cpToUtf16(text, 1)).toBe(2);
    expect(utf16ToCp(text, 2)).toBe(1);
  });

  it("clamps out-of-range offsets", () => {
    const doc = fromText("short");
    expect(textOffsetToPos(doc, 999)).toBe(1 + 5);
    expect(posToTextOffset(doc, 0)).toBe(0);
  });
});
