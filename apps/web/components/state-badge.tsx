import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type ContentState = Database["public"]["Enums"]["content_state"];

export const STATE_LABELS: Record<ContentState, string> = {
  draft: "Draft",
  ai_check: "AI check",
  needs_revision: "Needs revision",
  in_review: "In review",
  changes_requested: "Changes requested",
  specialist_review: "Specialist review",
  approved: "Approved",
  publish_ready: "Publish ready",
  archived: "Archived",
};

const STYLES: Record<ContentState, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  ai_check: "border-foreground/30 bg-card text-foreground",
  needs_revision: "border-accent-text bg-card text-accent-text",
  in_review: "border-foreground/30 bg-card text-foreground",
  changes_requested: "border-accent-text bg-card text-accent-text",
  specialist_review: "border-warning bg-warning-surface text-warning",
  approved: "border-success bg-card text-success",
  publish_ready: "border-success bg-success text-background",
  archived: "border-border bg-muted text-muted-foreground line-through",
};

export function StateBadge({ state, className }: { state: ContentState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[state],
        className,
      )}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
