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
      className="bg-warning-bg border-warning flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm"
    >
      <TriangleAlert aria-hidden className="text-warning size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="text-warning font-medium">AI checks unavailable ({reason}).</span> Showing
        deterministic findings only: facts, terms, claims lexicon, accessibility. Re-run when ready.
      </p>
      {action}
    </div>
  );
}
