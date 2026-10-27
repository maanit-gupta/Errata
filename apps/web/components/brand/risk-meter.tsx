import { cn } from "@/lib/utils";

/**
 * 5-segment risk bar + mono number (DESIGN.md §5, SPEC §10). Segments fill in `--warning`; a
 * routed blocker turns them `--blocker`. The number is always shown.
 */
export function RiskMeter({
  score,
  blocker = false,
  size = "md",
  className,
}: {
  score: number | null;
  blocker?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  if (score == null) return <span className={cn("mono-id text-fg-faint", className)}>RISK —</span>;
  // SPEC §10 scores run 0–~30+; 6 points per segment, capped at 5.
  const filled = Math.min(5, Math.ceil(score / 6));
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role="img"
      aria-label={`Risk ${score}${blocker ? ", routed blocker" : ""}`}
    >
      <span aria-hidden className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-[1px]",
              size === "sm" ? "h-2.5 w-1.5" : "h-3 w-2",
              i < filled ? (blocker ? "bg-blocker" : "bg-warning") : "bg-line-strong",
            )}
          />
        ))}
      </span>
      <span aria-hidden className={cn("mono-id", blocker ? "text-blocker" : "text-fg-muted")}>
        {size === "sm" ? score : `RISK ${score}`}
      </span>
    </span>
  );
}
