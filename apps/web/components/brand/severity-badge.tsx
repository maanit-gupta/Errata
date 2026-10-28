import { Lightbulb, OctagonX, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type Severity = Database["public"]["Enums"]["severity"];

/**
 * Severity chip (DESIGN.md §2.4): text label + icon + colour, never colour alone. Warning is a
 * burnt-orange tint with an outline, never yellow and never a solid fill.
 */
const STYLE: Record<Severity, { className: string; label: string; Icon: typeof OctagonX }> = {
  blocker: {
    className: "border-blocker bg-blocker text-blocker-fg",
    label: "Blocker",
    Icon: OctagonX,
  },
  warning: {
    className: "border-warning bg-warning-bg text-warning",
    label: "Warning",
    Icon: TriangleAlert,
  },
  suggestion: { className: "border-line text-suggestion", label: "Suggestion", Icon: Lightbulb },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { className: tone, label, Icon } = STYLE[severity];
  return (
    <span
      className={cn(
        "label inline-flex h-6 items-center gap-1 rounded-sm border-2 px-1.5 leading-none font-semibold whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
      {label}
    </span>
  );
}
