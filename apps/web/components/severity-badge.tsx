import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type Severity = Database["public"]["Enums"]["severity"];

const STYLES: Record<Severity, string> = {
  // Never colour alone: every badge carries its text label.
  blocker: "border-blocker bg-blocker text-blocker-foreground",
  warning: "border-warning bg-warning-surface text-warning",
  suggestion: "border-transparent bg-suggestion-surface text-suggestion",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold tracking-wider uppercase",
        STYLES[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}
