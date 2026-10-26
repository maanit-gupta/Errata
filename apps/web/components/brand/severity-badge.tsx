import { Lightbulb, OctagonX, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type Severity = Database["public"]["Enums"]["severity"];

const STYLE: Record<Severity, { className: string; Icon: typeof OctagonX }> = {
  blocker: { className: "border-blocker bg-blocker text-blocker-fg", Icon: OctagonX },
  warning: { className: "border-warning bg-warning-bg text-warning", Icon: TriangleAlert },
  suggestion: { className: "border-line-strong text-suggestion", Icon: Lightbulb },
};

/** Severity chip (DESIGN.md §2.4). Always a text label plus an icon, never colour alone. */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { className: tone, Icon } = STYLE[severity];
  return (
    <span
      className={cn(
        "mono-label inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 leading-none whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2} />
      {severity.toUpperCase()}
    </span>
  );
}
