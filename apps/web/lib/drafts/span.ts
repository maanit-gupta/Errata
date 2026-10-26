/** A finding's `span` jsonb (SPEC §3): text offsets, a pixel box (images), both (text read from an
 *  image), or alt-text offsets (`target: "alt_text"`). */

export type PixelBox = { x0: number; y0: number; x1: number; y1: number };
export type FindingTarget = "text" | "image" | "alt_text";

export function spanBox(span: unknown): PixelBox | null {
  if (!span || typeof span !== "object") return null;
  const s = span as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null);
  const [x0, y0, x1, y1] = [n("x0"), n("y0"), n("x1"), n("y1")];
  return x0 === null || y0 === null || x1 === null || y1 === null ? null : { x0, y0, x1, y1 };
}

export function spanTarget(span: unknown): FindingTarget {
  const s = (span && typeof span === "object" ? span : {}) as Record<string, unknown>;
  if (s.target === "alt_text") return "alt_text";
  return spanBox(span) && typeof s.start !== "number" ? "image" : "text";
}
