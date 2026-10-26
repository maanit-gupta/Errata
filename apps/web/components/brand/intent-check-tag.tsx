import { cn } from "@/lib/utils";

/**
 * Intent verification on rewrites (DESIGN.md §5, SPEC §9). `score` is the cosine against the
 * original; `dropped` carries the worker's reason when no safe fix survived.
 */
export function IntentCheckTag({
  score,
  dropped,
  className,
}: {
  score?: number | null;
  dropped?: string | null;
  className?: string;
}) {
  if (dropped)
    return <p className={cn("text-fg-muted text-xs", className)}>No safe fix. {dropped}</p>;
  return (
    <span className={cn("mono-label text-success inline-flex items-center gap-1", className)}>
      <span aria-hidden>✓</span> intent verified{score != null ? ` · ${score.toFixed(2)}` : ""}
    </span>
  );
}
