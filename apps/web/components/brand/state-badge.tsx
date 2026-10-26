import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type ContentState = Database["public"]["Enums"]["content_state"];

export const STATE_LABELS: Record<ContentState, string> = {
  draft: "Draft",
  ai_check: "Checking",
  needs_revision: "Needs revision",
  in_review: "In review",
  changes_requested: "Changes requested",
  specialist_review: "Specialist review",
  approved: "Approved",
  publish_ready: "Publish-ready",
  archived: "Archived",
};

const STYLES: Record<ContentState, string> = {
  draft: "border-line-strong text-fg-muted",
  ai_check: "border-accent text-fg",
  needs_revision: "border-transparent bg-blocker-bg text-blocker",
  in_review: "border-transparent bg-warning-bg text-warning",
  changes_requested: "border-transparent bg-warning-bg text-warning",
  specialist_review: "border-transparent bg-accent-deep text-accent-soft",
  approved: "border-transparent bg-success-bg text-success",
  publish_ready: "border-success bg-success text-canvas",
  archived: "border-line text-fg-faint",
};

const SPECIALIST: Record<string, string> = {
  legal: "Legal review",
  a11y: "A11y review",
  brand: "Brand review",
};

/** Content state chip (DESIGN.md §2.4): mono uppercase, 4px radius. */
export function StateBadge({
  state,
  routeTo,
  className,
}: {
  state: ContentState;
  /** `contents.route_to`, names the specialist queue. */
  routeTo?: string | null;
  className?: string;
}) {
  let label = STATE_LABELS[state];
  if (state === "specialist_review" && routeTo && SPECIALIST[routeTo]) label = SPECIALIST[routeTo];
  return (
    <span
      data-state={state}
      className={cn(
        "mono-label inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 leading-none whitespace-nowrap",
        STYLES[state],
        className,
      )}
    >
      {state === "ai_check" ? (
        <span aria-hidden className="spin inline-block">
          ⟳
        </span>
      ) : null}
      {state === "changes_requested" ? <span aria-hidden>↩</span> : null}
      {state === "publish_ready" ? <span aria-hidden>✓</span> : null}
      <span>{label}</span>
    </span>
  );
}
