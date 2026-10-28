import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Degraded run (CLAUDE.md errors): deterministic findings only, with a Re-run action. */
export function DegradedBanner({
  action,
  reason = "rate limit",
}: {
  action?: ReactNode;
  reason?: string;
}) {
  return (
    <div
      role="status"
      className="bg-warning-bg border-warning flex flex-wrap items-center gap-3 rounded-lg border-2 px-4 py-3 text-sm"
    >
      <TriangleAlert aria-hidden className="text-warning size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="text-warning font-bold">AI checks unavailable ({reason}).</span> Showing
        rule-based findings only. Re-run when ready.
      </p>
      {action}
    </div>
  );
}
