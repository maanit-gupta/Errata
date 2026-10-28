"use client";

import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const HUMAN_CONFIDENCE = 0.6; // mirrors worker config.HUMAN_CONFIDENCE

/** `conf 0.96`, or `Needs a person · 0.54` below 0.6 (DESIGN.md §7.14, invariant 6). */
export function ConfidenceChip({
  confidence,
  source,
  samples,
  className,
}: {
  confidence: number;
  source: "deterministic" | "llm";
  /** 2 when a blocker was confirmed by a second sample. */
  samples?: number;
  className?: string;
}) {
  const low = confidence < HUMAN_CONFIDENCE;
  const why =
    source === "deterministic"
      ? "Deterministic match = 1.00. No model judgement involved."
      : samples === 2
        ? `Retrieval similarity × agreement across 2 samples = ${confidence.toFixed(2)}.`
        : `Model confidence scaled by retrieval similarity = ${confidence.toFixed(2)}.`;
  const text = low ? `Needs a person · ${confidence.toFixed(2)}` : `conf ${confidence.toFixed(2)}`;
  return (
    <Hint content={low ? `${why} Below 0.6, a person must decide.` : why}>
      <button
        type="button"
        className={cn(
          "mono-id inline-flex h-6 items-center rounded-sm px-1.5 whitespace-nowrap",
          low ? "border-warning bg-warning-bg text-warning border-2" : "text-fg-muted",
          className,
        )}
        aria-label={`${text}. ${why}`}
      >
        {text}
      </button>
    </Hint>
  );
}
