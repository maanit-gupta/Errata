import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// DESIGN.md §10: colours come from tokens only. Tailwind's default palette (zinc, slate, gray,
// black, white…) bypasses the theme and its contrast tests, so it is banned in .tsx like raw hex.
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PREFIX =
  "bg|text|border|border-[xytrblse]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|caret|accent|decoration|shadow|inset-shadow|inset-ring";
const PALETTE_SHADE = `(^|[^a-z-])(${PREFIX})-(${PALETTE})-(50|[1-9]00|950)`;
const PALETTE_BW = `(^|[^a-z-])(${PREFIX})-(black|white)([^a-z-]|$)`;
// Yellow (`--highlight`) is a fill only: as text or a thin line on white it fails contrast.
const YELLOW_AS_TEXT = "(^|[^a-z-])(text|decoration|placeholder|caret)-highlight([^a-z-]|$)";
const yellowRules = ["Literal[value=/RE/]", "TemplateElement[value.raw=/RE/]"].map((sel) => ({
  selector: sel.replace("RE", YELLOW_AS_TEXT),
  message:
    "Yellow is a fill only, never text (DESIGN.md §2.2). Use text-highlight-fg on bg-highlight.",
}));
const paletteRules = [PALETTE_SHADE, PALETTE_BW].flatMap((re) => [
  {
    selector: `Literal[value=/${re}/]`,
    message: "Tailwind palette colour in .tsx. Use a token class (DESIGN.md §2).",
  },
  {
    selector: `TemplateElement[value.raw=/${re}/]`,
    message: "Tailwind palette colour in .tsx. Use a token class (DESIGN.md §2).",
  },
]);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // DESIGN.md §10: tokens only. Colours come from app/globals.css or lib/design/tokens.ts.
  // No raw hex and no Tailwind palette classes.
  {
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw hex colour in .tsx. Use a token (DESIGN.md §2).",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw hex colour in .tsx. Use a token (DESIGN.md §2).",
        },
        ...paletteRules,
        ...yellowRules,
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
