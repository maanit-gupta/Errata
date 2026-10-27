import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  TOKEN_NAMES,
  TOKENS,
  type Theme,
  type TokenName,
} from "@/lib/design/tokens";

/** Parses the `tokens:<theme>` block of globals.css into name → hex. */
function cssTokens(theme: Theme): Record<string, string> {
  const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
  const start = css.indexOf(`/* tokens:${theme}:start */`);
  const end = css.indexOf(`/* tokens:${theme}:end */`);
  expect(start, `tokens:${theme} block`).toBeGreaterThan(-1);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

// DESIGN.md §2.3: [foreground, background, minimum ratio].
type Row = [TokenName, TokenName, number];
const AA_TEXT = 4.5;
const AA_UI = 3;

const DARK: Row[] = [
  ["text", "bg", AA_TEXT],
  ["text-muted", "bg", AA_TEXT],
  ["text-faint", "bg", AA_TEXT],
  ["text-faint", "bg-elevated", AA_TEXT],
  ["accent-fg", "accent", AA_TEXT],
  ["accent-soft", "bg", AA_TEXT],
  ["accent-soft", "bg-elevated", AA_TEXT],
  ["blocker", "bg", AA_TEXT],
  ["blocker-fg", "blocker", AA_TEXT],
  ["warning", "bg", AA_TEXT],
  ["success", "bg", AA_TEXT],
  ["danger", "bg", AA_TEXT],
  ["bg", "success", AA_TEXT], // publish-ready: ink on solid green
  ["border-control", "bg", AA_UI],
  ["focus", "bg", AA_UI],
];

const LIGHT: Row[] = [
  ["text", "bg", AA_TEXT],
  ["text-muted", "bg", AA_TEXT],
  ["text-faint", "bg", AA_TEXT],
  ["text-faint", "bg-elevated", AA_TEXT],
  ["accent", "bg", AA_TEXT],
  ["accent-fg", "accent", AA_TEXT],
  ["accent-soft", "bg", AA_TEXT],
  ["blocker", "bg", AA_TEXT],
  ["blocker-fg", "blocker", AA_TEXT],
  ["warning", "bg", AA_TEXT],
  ["success", "bg", AA_TEXT],
  ["danger", "bg", AA_TEXT],
  ["bg", "success", AA_TEXT],
  ["border-control", "bg", AA_UI],
  ["mint", "bg", AA_UI], // large text only (gradient word)
  ["focus", "bg", AA_UI],
];

describe.each([
  ["dark", DARK],
  ["light", LIGHT],
] as const)("%s theme", (theme, rows) => {
  it("tokens.ts mirrors globals.css", () => {
    const css = cssTokens(theme);
    for (const name of TOKEN_NAMES) expect(TOKENS[theme][name], name).toBe(css[name]);
  });

  it.each(rows)("%s on %s ≥ %s:1", (fg, bg, min) => {
    expect(contrastRatio(TOKENS[theme][fg], TOKENS[theme][bg])).toBeGreaterThanOrEqual(min);
  });
});
