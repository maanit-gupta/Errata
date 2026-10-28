import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Intent verification on rewrites (DESIGN.md §7.14, SPEC §9). `score` is the cosine against the
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
    <span
      className={cn("label text-success inline-flex items-center gap-1 font-semibold", className)}
    >
      <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
      Intent verified
      {score != null ? <span className="mono-id">· {score.toFixed(2)}</span> : null}
    </span>
  );
}
