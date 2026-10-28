/**
 * TS mirror of the colour tokens in app/globals.css (docs/DESIGN.md §2.1), for code that can't
 * read CSS variables: Recharts, canvas overlays, the theme-color meta and the contrast test.
 * Prefer `var(--x)` in markup; tests/tokens.contrast.test.ts fails if this file drifts.
 */

export const TOKEN_NAMES = [
  "bg",
  "bg-elevated",
  "bg-hover",
  "bg-code",
  "band-grey",
  "band-pink",
  "border",
  "border-strong",
  "border-control",
  "outline",
  "focus",
  "text",
  "text-muted",
  "text-faint",
  "accent",
  "accent-hover",
  "accent-fg",
  "accent-soft",
  "accent-deep",
  "highlight",
  "highlight-fg",
  "mint",
  "info",
  "blocker",
  "blocker-fg",
  "blocker-bg",
  "warning",
  "warning-bg",
  "suggestion",
  "success",
  "success-bg",
  "danger",
  "illo-ink",
  "illo-paper",
  "illo-yellow",
  "illo-pink",
  "illo-green",
  "illo-blue",
  "illo-red",
  "illo-grey",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Theme = "dark" | "light";

export const TOKENS: Record<Theme, Record<TokenName, string>> = {
  light: {
    bg: "#ffffff",
    "bg-elevated": "#ffffff",
    "bg-hover": "#eeeeec",
    "bg-code": "#f6f6f4",
    "band-grey": "#eeeeec",
    "band-pink": "#facbed",
    border: "#d9d9d4",
    "border-strong": "#000000",
    "border-control": "#000000",
    outline: "#000000",
    focus: "#000000",
    text: "#000000",
    "text-muted": "#45453f",
    "text-faint": "#5e5e58",
    accent: "#000000",
    "accent-hover": "#2e2e2b",
    "accent-fg": "#ffffff",
    "accent-soft": "#000000",
    "accent-deep": "#facbed",
    highlight: "#f7b924",
    "highlight-fg": "#000000",
    mint: "#146f4c",
    info: "#46627c",
    blocker: "#a31428",
    "blocker-fg": "#ffffff",
    "blocker-bg": "#fbe6e9",
    warning: "#a14400",
    "warning-bg": "#fde7d6",
    suggestion: "#45453f",
    success: "#137a52",
    "success-bg": "#e3f3ea",
    danger: "#a31428",
    "illo-ink": "#000000",
    "illo-paper": "#ffffff",
    "illo-yellow": "#f7b924",
    "illo-pink": "#facbed",
    "illo-green": "#189364",
    "illo-blue": "#5e7d99",
    "illo-red": "#a31428",
    "illo-grey": "#eeeeec",
  },
  dark: {
    bg: "#121211",
    "bg-elevated": "#1b1b19",
    "bg-hover": "#272725",
    "bg-code": "#0b0b0a",
    "band-grey": "#1f1f1d",
    "band-pink": "#3b2135",
    border: "#34342f",
    "border-strong": "#ecebe6",
    "border-control": "#ecebe6",
    outline: "#ecebe6",
    focus: "#f2f1ec",
    text: "#f2f1ec",
    "text-muted": "#b6b5ad",
    "text-faint": "#9a9991",
    accent: "#f2f1ec",
    "accent-hover": "#d8d7d0",
    "accent-fg": "#121211",
    "accent-soft": "#f2f1ec",
    "accent-deep": "#4a2343",
    highlight: "#f7b924",
    "highlight-fg": "#000000",
    mint: "#4cc992",
    info: "#9db7cf",
    blocker: "#ff7d8c",
    "blocker-fg": "#121211",
    "blocker-bg": "#3e1a21",
    warning: "#ff9d57",
    "warning-bg": "#3a2415",
    suggestion: "#b6b5ad",
    success: "#4cc992",
    "success-bg": "#15301f",
    danger: "#ff7d8c",
    "illo-ink": "#ecebe6",
    "illo-paper": "#2a2a26",
    "illo-yellow": "#f7b924",
    "illo-pink": "#e9a6d6",
    "illo-green": "#2fae7c",
    "illo-blue": "#7f9ab3",
    "illo-red": "#d2384c",
    "illo-grey": "#3a3a35",
  },
};

/** CSS variable reference, for inline styles and SVG attributes. */
export const cssVar = (name: TokenName) => `var(--${name})`;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
