import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

/** `DETERMINISTIC` or `AI-ASSISTED` (DESIGN.md §5; invariant 9). Required on every finding. */
export function SourceTag({
  source,
  className,
}: {
  source: "deterministic" | "llm";
  className?: string;
}) {
  return source === "llm" ? (
    <span className={cn("mono-label text-accent-soft inline-flex items-center gap-1", className)}>
      <Bot aria-hidden className="size-3.5" strokeWidth={1.5} />
      AI-ASSISTED
    </span>
  ) : (
    <span className={cn("mono-label text-fg-faint", className)}>DETERMINISTIC</span>
  );
}
