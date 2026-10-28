import { Check, Inbox, LoaderCircle, Undo2 } from "lucide-react";
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
  draft: "border-line text-fg-muted",
  ai_check: "border-outline text-fg",
  needs_revision: "border-blocker bg-blocker-bg text-blocker",
  in_review: "border-outline text-fg",
  changes_requested: "border-warning bg-warning-bg text-warning",
  specialist_review: "border-outline bg-accent-deep text-fg",
  approved: "border-success bg-success-bg text-success",
  publish_ready: "border-success bg-success text-canvas",
  archived: "border-line text-fg-faint",
};

const SPECIALIST: Record<string, string> = {
  legal: "Legal review",
  a11y: "A11y review",
  brand: "Brand review",
};

/** Content state chip (DESIGN.md §2.4). The DOM text is the plain label; icons are decorative. */
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
  const icon = "size-3.5 shrink-0";
  return (
    <span
      data-state={state}
      className={cn(
        "label inline-flex h-6 items-center gap-1 rounded-sm border-2 px-1.5 leading-none font-semibold whitespace-nowrap",
        STYLES[state],
        className,
      )}
    >
      {state === "ai_check" ? <LoaderCircle aria-hidden className={cn(icon, "spin")} /> : null}
      {state === "in_review" ? <Inbox aria-hidden className={icon} /> : null}
      {state === "changes_requested" ? <Undo2 aria-hidden className={icon} /> : null}
      {state === "approved" || state === "publish_ready" ? (
        <Check aria-hidden className={icon} strokeWidth={2.5} />
      ) : null}
      <span>{label}</span>
    </span>
  );
}
