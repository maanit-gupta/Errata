import {
  Accessibility,
  AudioLines,
  CalendarCheck,
  Palette,
  Scale,
  SpellCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type Dimension = Database["public"]["Enums"]["dimension"];

/** Dimensions (DESIGN.md §2.4): mono label + icon, never colour, so they can't read as severity. */
export const DIMENSIONS: Record<Dimension, { label: string; Icon: LucideIcon }> = {
  tone: { label: "Tone", Icon: AudioLines },
  terms: { label: "Terms", Icon: SpellCheck },
  facts: { label: "Facts", Icon: CalendarCheck },
  claims: { label: "Claims", Icon: Scale },
  visual: { label: "Visual", Icon: Palette },
  access: { label: "Access", Icon: Accessibility },
};

export function DimensionLabel({
  dimension,
  className,
}: {
  dimension: string;
  className?: string;
}) {
  const d = DIMENSIONS[dimension as Dimension];
  if (!d) return <span className={cn("label text-fg-muted", className)}>{dimension}</span>;
  return (
    <span className={cn("label text-fg-muted inline-flex items-center gap-1", className)}>
      <d.Icon aria-hidden className="size-3.5" strokeWidth={2} />
      {d.label}
    </span>
  );
}
