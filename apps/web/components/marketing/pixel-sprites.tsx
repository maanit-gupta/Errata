"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { cn } from "@/lib/utils";

const FILLS = ["bg-accent", "bg-accent-soft", "bg-fg"];

type Sprite = { id: number; x: number; y: number; cells: [number, number, string][] };

/**
 * Pixel glitch sprites (DESIGN.md §4.1): sparse 8–12px clusters at grid intersections that toggle
 * in steps(4) and vanish. Decorative, marketing only, kept out of text areas by the caller.
 */
export function PixelSprites({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [sprite, setSprite] = useState<Sprite | null>(null);
  useEffect(() => {
    if (reduced) return;
    let id = 0;
    const t = setInterval(() => {
      const cells: [number, number, string][] = Array.from(
        { length: 3 + Math.floor(Math.random() * 4) },
        () => [
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 3),
          FILLS[Math.floor(Math.random() * FILLS.length)],
        ],
      );
      setSprite({
        id: ++id,
        x: Math.floor(Math.random() * 5),
        y: Math.floor(Math.random() * 3),
        cells,
      });
    }, 1400);
    return () => clearInterval(t);
  }, [reduced]);
  return (
    <div aria-hidden className={cn("pointer-events-none absolute", className)}>
      {sprite ? (
        <div
          key={sprite.id}
          className="pixel-glitch absolute"
          style={{ left: sprite.x * 64, top: sprite.y * 64 }}
        >
          {sprite.cells.map(([cx, cy, fill], i) => (
            <span
              key={i}
              className={cn("absolute size-1 sm:size-[4px]", fill)}
              style={{ left: cx * 4, top: cy * 4 }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const COMPOSITION = [
  "......a.......s.....",
  "....aa.a....ss......",
  "..s.aaaaa..s.a..t...",
  ".aa.aaaaaaaaaaa.....",
  "aaaaaaasaaaaaaaaa.s.",
  "aaaaasssaaaatttaaaa.",
];

/** Footer pixel composition: static cells, each with a slow shimmer (none when reduced). */
export function PixelComposition({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none grid", className)}
      style={{ gridTemplateColumns: `repeat(${COMPOSITION[0].length}, 16px)` }}
    >
      {COMPOSITION.flatMap((row, y) =>
        [...row].map((c, x) => (
          <span
            key={`${x}-${y}`}
            className={cn(
              "size-4",
              c === "a" && "bg-accent",
              c === "s" && "bg-accent-soft pixel-shimmer",
              c === "t" && "bg-accent-pixel pixel-shimmer",
            )}
            style={c !== "." ? { animationDelay: `${((x * 7 + y * 13) % 40) / 10}s` } : undefined}
          />
        )),
      )}
    </div>
  );
}
