/**
 * Colour evidence for image findings (DESIGN.md §6.11). The worker writes measured colours into
 * the explanation in fixed formats (apps/worker/brandlens_worker/pipeline/image.py):
 *   contrast: "… 2.31 : 1 (#9A9A9A on #FFFFFF) …"
 *   palette:  "#3A7BD5 is ΔE 18.4 from the nearest palette colour (Ocean #2F6FD0) …"
 * Parsing them here keeps findings free of extra columns; anything that doesn't match renders no
 * swatches, so the card degrades to the plain explanation.
 */
export type Swatches =
  | { kind: "contrast"; ratio: number; fg: string; bg: string }
  | { kind: "delta_e"; deltaE: number; found: string; nearest: string; nearestName: string };

const HEX = "#[0-9A-Fa-f]{6}";
const CONTRAST = new RegExp(`(\\d+(?:\\.\\d+)?) : 1 \\((${HEX}) on (${HEX})\\)`);
const DELTA_E = new RegExp(
  `(${HEX}) is ΔE (\\d+(?:\\.\\d+)?) from the nearest palette colour \\((.+?) (${HEX})\\)`,
);

export function parseSwatches(explanation: string): Swatches | null {
  const c = CONTRAST.exec(explanation);
  if (c) return { kind: "contrast", ratio: Number(c[1]), fg: c[2]!, bg: c[3]! };
  const d = DELTA_E.exec(explanation);
  if (d)
    return {
      kind: "delta_e",
      found: d[1]!,
      deltaE: Number(d[2]),
      nearestName: d[3]!,
      nearest: d[4]!,
    };
  return null;
}
