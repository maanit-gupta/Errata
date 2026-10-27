/**
 * TS mirror of the colour tokens in app/globals.css (docs/DESIGN.md §2), for code that can't
 * read CSS variables: Recharts, canvas overlays and the contrast test. Prefer `var(--x)` in
 * markup; tests/tokens.contrast.test.ts fails if this file drifts from globals.css.
 */

export const TOKEN_NAMES = [
  "bg",
  "bg-elevated",
  "bg-hover",
  "bg-code",
  "border",
  "border-strong",
  "border-control",
  "text",
  "text-muted",
  "text-faint",
  "accent",
  "accent-hover",
  "accent-fg",
  "accent-soft",
  "accent-deep",
  "mint",
  "blocker",
  "blocker-fg",
  "warning",
  "suggestion",
  "success",
  "danger",
  "focus",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Theme = "dark" | "light";

export const TOKENS: Record<Theme, Record<TokenName, string>> = {
  dark: {
    bg: "#0d0d0f",
    "bg-elevated": "#141416",
    "bg-hover": "#1b1b1f",
    "bg-code": "#0a0a0b",
    border: "#232327",
    "border-strong": "#34343a",
    "border-control": "#6b6b73",
    text: "#f5f5f7",
    "text-muted": "#a1a1aa",
    "text-faint": "#8b8b94",
    accent: "#8a2bff",
    "accent-hover": "#7a1ff0",
    "accent-fg": "#ffffff",
    "accent-soft": "#b9a2ff",
    "accent-deep": "#1c0533",
    mint: "#7cf5c8",
    blocker: "#ff6a4d",
    "blocker-fg": "#0d0d0f",
    warning: "#f5b544",
    suggestion: "#a1a1aa",
    success: "#22e07a",
    danger: "#ff5a5f",
    focus: "#b9a2ff",
  },
  light: {
    bg: "#fafafa",
    "bg-elevated": "#ffffff",
    "bg-hover": "#f0f0f2",
    "bg-code": "#f4f4f6",
    border: "#e4e4e7",
    "border-strong": "#d4d4d8",
    "border-control": "#8e8e96",
    text: "#0d0d0f",
    "text-muted": "#52525b",
    "text-faint": "#6b6b73",
    accent: "#7a1ff0",
    "accent-hover": "#6a14db",
    "accent-fg": "#ffffff",
    "accent-soft": "#6a2bd9",
    "accent-deep": "#f1e9ff",
    mint: "#0e8a62",
    blocker: "#c2301b",
    "blocker-fg": "#ffffff",
    warning: "#8a5a00",
    suggestion: "#52525b",
    success: "#0f7a43",
    danger: "#b4232a",
    focus: "#7a1ff0",
  },
};

/** CSS variable reference, for inline styles and SVG attributes. */
export const cssVar = (name: TokenName | "blocker-bg" | "warning-bg" | "success-bg") =>
  `var(--${name})`;

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
