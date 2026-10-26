"use client";

import { useState } from "react";
import type { Severity } from "@/components/brand/severity-badge";
import type { PixelBox } from "@/lib/drafts/span";
import { cn } from "@/lib/utils";

export type ImageMarker = {
  id: string;
  severity: Severity;
  codes: string; // "VS-03" or "A-02 · WCAG 1.4.3"
  label: string; // the finding's quote
  box: PixelBox;
};

const BOX: Record<Severity, string> = {
  // Colour is never the only cue: each box's tag spells out the severity.
  blocker: "border-blocker bg-blocker/15",
  warning: "border-warning bg-warning/10 border-dashed",
  suggestion: "border-suggestion border-dotted",
};
const TAG: Record<Severity, string> = {
  blocker: "bg-blocker text-blocker-fg",
  warning: "bg-warning-bg text-warning border-warning border",
  suggestion: "bg-hover text-suggestion",
};

/** Share of the image a box covers; findings about the whole image aren't drawn as boxes. */
const WHOLE = 0.9;

/**
 * The uploaded image with one numbered, labelled box per finding (SPEC §3 pixel spans). Boxes are
 * buttons: hovering or focusing one highlights its finding card (and vice versa via `active`);
 * activating it scrolls to the card (`#finding-<id>`). Without `onFocus` the viewer keeps its own
 * highlight state (read-only review page).
 */
export function ImageFindings({
  src,
  alt,
  markers,
  active,
  onFocus,
}: {
  src: string;
  alt: string;
  markers: ImageMarker[];
  active?: string | null;
  onFocus?: (id: string | null, scroll?: boolean) => void;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const current = onFocus ? (active ?? null) : hover;
  const focus = (id: string | null, scroll = false) =>
    onFocus ? onFocus(id, scroll) : setHover(id);

  const area = size ? size.w * size.h : 1;
  const covers = (m: ImageMarker) =>
    ((m.box.x1 - m.box.x0) * (m.box.y1 - m.box.y0)) / area >= WHOLE;
  const boxed = size ? markers.filter((m) => !covers(m)) : [];
  const whole = size ? markers.filter(covers) : [];
  const number = new Map(markers.map((m, i) => [m.id, i + 1]));
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  const reveal = (id: string) => {
    focus(id, true);
    document.getElementById(`finding-${id}`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <figure className="m-0">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL */}
        <img
          src={src}
          alt={alt}
          className="block h-auto w-full rounded-md"
          onLoad={(e) =>
            setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
        />
        {whole.some((m) => m.id === current) ? (
          <div
            aria-hidden
            className="border-ring pointer-events-none absolute inset-0 rounded-md border-4"
          />
        ) : null}
        {size
          ? boxed.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Finding ${number.get(m.id)}, ${m.severity}, ${m.codes}: ${m.label}`}
                onMouseEnter={() => focus(m.id)}
                onMouseLeave={() => focus(null)}
                onFocus={() => focus(m.id)}
                onBlur={() => focus(null)}
                onClick={() => reveal(m.id)}
                className={cn(
                  "focus-visible:outline-ring absolute rounded-sm border-2 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2",
                  BOX[m.severity],
                  current === m.id && "ring-ring ring-2 ring-offset-1",
                )}
                style={{
                  left: pct(m.box.x0, size.w),
                  top: pct(m.box.y0, size.h),
                  width: pct(Math.max(m.box.x1 - m.box.x0, 4), size.w),
                  height: pct(Math.max(m.box.y1 - m.box.y0, 4), size.h),
                }}
              >
                <span
                  className={cn(
                    "absolute -top-5 left-0 rounded-sm px-1 font-mono text-[0.65rem] leading-4 font-semibold whitespace-nowrap uppercase",
                    TAG[m.severity],
                  )}
                >
                  {number.get(m.id)} · {m.codes.split(" · ")[0]} · {m.severity}
                </span>
              </button>
            ))
          : null}
      </div>
      {whole.length ? (
        <figcaption className="mt-2 text-sm">
          <span className="text-fg-muted">Applies to the whole image: </span>
          {whole.map((m, i) => (
            <span key={m.id}>
              {i ? ", " : ""}
              <button
                type="button"
                className="hover:text-fg focus-visible:outline-ring font-mono text-xs underline underline-offset-2"
                onMouseEnter={() => focus(m.id)}
                onMouseLeave={() => focus(null)}
                onClick={() => reveal(m.id)}
              >
                {number.get(m.id)} · {m.codes.split(" · ")[0]} ({m.label})
              </button>
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
