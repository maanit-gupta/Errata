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
  tone: { label: "TONE", Icon: AudioLines },
  terms: { label: "TERMS", Icon: SpellCheck },
  facts: { label: "FACTS", Icon: CalendarCheck },
  claims: { label: "CLAIMS", Icon: Scale },
  visual: { label: "VISUAL", Icon: Palette },
  access: { label: "ACCESS", Icon: Accessibility },
};

export function DimensionLabel({
  dimension,
  className,
}: {
  dimension: string;
  className?: string;
}) {
  const d = DIMENSIONS[dimension as Dimension];
  if (!d) return <span className={cn("mono-label text-fg-muted", className)}>{dimension}</span>;
  return (
    <span className={cn("mono-label text-fg-muted inline-flex items-center gap-1", className)}>
      <d.Icon aria-hidden className="size-3.5" strokeWidth={1.5} />
      {d.label}
    </span>
  );
}
