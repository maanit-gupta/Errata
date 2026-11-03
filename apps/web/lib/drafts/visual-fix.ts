import { z } from "zod";

/**
 * Hero 3 (visual auto-heal): the worker's palette-only contrast fix on a WCAG 1.4.3 finding
 * (`findings.visual_fix`, written by vision/autoheal.py). Colours are rendered as inline styles,
 * so only strict #RRGGBB values get through; anything else means no preview.
 */
const hex = z.string().regex(/^#[0-9A-F]{6}$/);

const VisualFixSchema = z.object({
  original_text_hex: hex,
  original_bg_hex: hex,
  original_ratio: z.number().nonnegative(),
  healed_text_hex: hex,
  healed_text_name: z.string().max(60).nullable(),
  healed_bg_hex: hex,
  healed_bg_name: z.string().max(60).nullable(),
  healed_ratio: z.number().nonnegative(),
  required_ratio: z.union([z.literal(3), z.literal(4.5)]),
  strategy: z.enum(["text", "background", "both"]),
  source: z.literal("palette"),
});

export type VisualFix = z.infer<typeof VisualFixSchema>;

export function parseVisualFix(value: unknown): VisualFix | null {
  const parsed = VisualFixSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The fix as CSS a designer can paste (Hero 3). Built only from the validated hex values. */
export function cssPatch(fix: VisualFix): string {
  const named = (hex: string, palette: string | null) =>
    palette ? `${hex}; /* ${palette} */` : `${hex};`;
  return [
    `/* Errata palette fix, WCAG 1.4.3: ${fix.healed_ratio} : 1 (needs ${fix.required_ratio} : 1) */`,
    `color: ${named(fix.healed_text_hex, fix.healed_text_name)}`,
    `background-color: ${named(fix.healed_bg_hex, fix.healed_bg_name)}`,
  ].join("\n");
}
