import { cn } from "@/lib/utils";

/**
 * Pixel glyphs (DESIGN.md §2.7): cell maps rendered as crisp SVG rects. Marketing pages and
 * empty states only. `a` = violet, `s` = lilac, `t` = text colour, `.` = empty.
 */
const GLYPHS = {
  lens: [
    ".tttt...",
    "t....t..",
    "t.aa.t..",
    "t.aa.t..",
    "t....t..",
    ".tttt...",
    ".....tt.",
    "......tt",
  ],
  "shield-check": [
    ".....ssssss.....",
    "...ssssssssss...",
    "..ssssssssssss..",
    "..sssssssssstt..",
    "..ssssssssstts..",
    "..sstsssssttss..",
    "..sstttssttsss..",
    "..ssstttttssss..",
    "..sssstttsssss..",
    "...ssssssssss...",
    "....ssssssss....",
    ".....ssssss.....",
    "......ssss......",
    ".......ss.......",
  ],
  "calendar-x": [
    "...tt......tt...",
    "..aaaaaaaaaaaa..",
    "..aaaaaaaaaaaa..",
    "..s..........s..",
    "..s.tt....tt.s..",
    "..s..tt..tt..s..",
    "..s...tttt...s..",
    "..s...tttt...s..",
    "..s..tt..tt..s..",
    "..s.tt....tt.s..",
    "..s..........s..",
    "..ssssssssssss..",
  ],
  scale: [
    ".......tt.......",
    "..aaaaaaaaaaaa..",
    "..s....tt....s..",
    ".s.s...tt...s.s.",
    "s...s..tt..s...s",
    "sssss..tt..sssss",
    ".sss...tt...sss.",
    ".......tt.......",
    ".......tt.......",
    ".....tttttt.....",
    "....aaaaaaaa....",
  ],
  "id-badge": [
    "......aaaa......",
    "..ssssssssssss..",
    "..s..........s..",
    "..s.tt.tttt..s..",
    "..s.tt.......s..",
    "..s.tt.ttt...s..",
    "..s..........s..",
    "..s.aaaaaaaa.s..",
    "..s..........s..",
    "..s.ssss.....s..",
    "..s..........s..",
    "..ssssssssssss..",
  ],
  lock: [
    ".....tttttt.....",
    "....tt....tt....",
    "....t......t....",
    "....t......t....",
    "..aaaaaaaaaaaa..",
    "..aaaaaaaaaaaa..",
    "..aaaaassaaaaa..",
    "..aaaaassaaaaa..",
    "..aaaaaassaaaa..",
    "..aaaaaaaaaaaa..",
    "..aaaaaaaaaaaa..",
  ],
  "chart-bars": [
    "............ss..",
    "............ss..",
    "........aa..ss..",
    "........aa..ss..",
    "....tt..aa..ss..",
    "....tt..aa..ss..",
    "tt..tt..aa..ss..",
    "tt..tt..aa..ss..",
    "tt..tt..aa..ss..",
    "ssssssssssssssss",
  ],
  eye: [
    ".....tttttt.....",
    "...tt......tt...",
    "..t....aa....t..",
    ".t....aaaa....t.",
    "t....aassaa....t",
    ".t....aaaa....t.",
    "..t....aa....t..",
    "...tt......tt...",
    ".....tttttt.....",
  ],
  stamp: [
    "......aaaa......",
    ".....aaaaaa.....",
    "......aaaa......",
    ".......aa.......",
    ".......aa.......",
    "....ssssssss....",
    "..ssssssssssss..",
    "..ssssssssssss..",
    "................",
    "..tttttttttttt..",
  ],
} as const;

export type GlyphName = keyof typeof GLYPHS;
export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];

const FILL = { a: "var(--accent)", s: "var(--accent-soft)", t: "var(--text)" } as const;

export function PixelGlyph({
  name,
  size = 32,
  className,
  title,
}: {
  name: GlyphName;
  size?: number;
  className?: string;
  /** Accessible name; omit for decorative use. */
  title?: string;
}) {
  const rows = GLYPHS[name];
  const cols = Math.max(...rows.map((r) => r.length));
  const dim = Math.max(cols, rows.length);
  const offY = Math.floor((dim - rows.length) / 2);
  const offX = Math.floor((dim - cols) / 2);
  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x + offX}
              y={y + offY}
              width={1}
              height={1}
              fill={FILL[c as keyof typeof FILL]}
            />
          ),
        ),
      )}
    </svg>
  );
}
