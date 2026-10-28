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

/**
 * Parses the `tokens:start … tokens:end` block of globals.css. Every colour token is defined once
 * as `--name: light-dark(#light, #dark);` (DESIGN.md §2.1), so a stray rgba or a missing pair
 * fails here rather than silently skipping a contrast row.
 */
function cssTokens(): Record<Theme, Record<string, string>> {
  const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
  const start = css.indexOf("/* tokens:start */");
  const end = css.indexOf("/* tokens:end */");
  expect(start, "tokens:start marker").toBeGreaterThan(-1);
  expect(end, "tokens:end marker").toBeGreaterThan(start);
  const block = css.slice(start, end);
  const out: Record<Theme, Record<string, string>> = { light: {}, dark: {} };
  const decl = /--([a-z-]+):\s*([^;]+);/g;
  for (const m of block.matchAll(decl)) {
    const pair = /^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i.exec(m[2].trim());
    expect(pair, `--${m[1]} must be light-dark(#rrggbb, #rrggbb)`).not.toBeNull();
    out.light[m[1]] = pair![1].toLowerCase();
    out.dark[m[1]] = pair![2].toLowerCase();
  }
  return out;
}

// DESIGN.md §2.3: [foreground, background, minimum ratio]. Same rows in both themes.
type Row = [TokenName, TokenName, number];
const AA_TEXT = 4.5;
const AA_UI = 3;

const ROWS: Row[] = [
  // Text on every surface it sits on, including the grey and pink section bands.
  ["text", "bg", AA_TEXT],
  ["text", "bg-elevated", AA_TEXT],
  ["text", "bg-hover", AA_TEXT],
  ["text", "band-grey", AA_TEXT],
  ["text", "band-pink", AA_TEXT],
  ["text-muted", "bg", AA_TEXT],
  ["text-muted", "bg-elevated", AA_TEXT],
  ["text-muted", "bg-hover", AA_TEXT],
  ["text-muted", "band-grey", AA_TEXT],
  ["text-muted", "band-pink", AA_TEXT],
  ["text-faint", "bg", AA_TEXT],
  ["text-faint", "bg-elevated", AA_TEXT],
  ["text-faint", "bg-hover", AA_TEXT],
  ["text-faint", "bg-code", AA_TEXT],
  ["text-faint", "band-grey", AA_TEXT],
  ["text-faint", "band-pink", AA_TEXT],
  // Ink actions: links, ID chips, primary buttons (accent-fg on accent), pink tints.
  ["accent-soft", "bg", AA_TEXT],
  ["accent-soft", "bg-elevated", AA_TEXT],
  ["accent-soft", "bg-hover", AA_TEXT],
  ["accent-soft", "accent-deep", AA_TEXT],
  ["text", "accent-deep", AA_TEXT],
  ["accent-fg", "accent", AA_TEXT],
  ["accent-fg", "accent-hover", AA_TEXT],
  // Yellow is a fill only, always with black text on it (never yellow text).
  ["highlight-fg", "highlight", AA_TEXT],
  ["info", "bg", AA_TEXT],
  // Severity and state chips, on the page and on their own tint.
  ["blocker", "bg", AA_TEXT],
  ["blocker", "bg-elevated", AA_TEXT],
  ["blocker", "blocker-bg", AA_TEXT],
  ["blocker-fg", "blocker", AA_TEXT],
  ["warning", "bg", AA_TEXT],
  ["warning", "bg-elevated", AA_TEXT],
  ["warning", "warning-bg", AA_TEXT],
  ["suggestion", "bg", AA_TEXT],
  ["suggestion", "bg-elevated", AA_TEXT],
  ["success", "bg", AA_TEXT],
  ["success", "bg-elevated", AA_TEXT],
  ["success", "success-bg", AA_TEXT],
  ["bg", "success", AA_TEXT], // publish-ready: page colour on solid green
  ["danger", "bg", AA_TEXT],
  ["danger", "bg-elevated", AA_TEXT],
  ["bg", "danger", AA_TEXT], // danger button hover: page colour on solid danger
  // UI boundaries (WCAG 1.4.11): 2px outlines, control borders, focus ring, ink fills.
  ["outline", "bg", AA_UI],
  ["outline", "bg-elevated", AA_UI],
  ["outline", "band-grey", AA_UI],
  ["outline", "band-pink", AA_UI],
  ["border-control", "bg", AA_UI],
  ["border-control", "bg-elevated", AA_UI],
  ["focus", "bg", AA_UI],
  ["focus", "bg-elevated", AA_UI],
  ["focus", "band-grey", AA_UI],
  ["focus", "band-pink", AA_UI],
  ["accent", "bg", AA_UI],
  ["accent", "bg-elevated", AA_UI],
  ["mint", "bg", AA_UI], // large text only
];

const css = cssTokens();

it("globals.css defines exactly the tokens tokens.ts names", () => {
  expect(Object.keys(css.light).sort()).toEqual([...TOKEN_NAMES].sort());
});

describe.each(["light", "dark"] as const)("%s theme", (theme) => {
  it("tokens.ts mirrors globals.css", () => {
    for (const name of TOKEN_NAMES) expect(TOKENS[theme][name], name).toBe(css[theme][name]);
  });

  it.each(ROWS)("%s on %s ≥ %s:1", (fg, bg, min) => {
    expect(contrastRatio(TOKENS[theme][fg], TOKENS[theme][bg])).toBeGreaterThanOrEqual(min);
  });
});
