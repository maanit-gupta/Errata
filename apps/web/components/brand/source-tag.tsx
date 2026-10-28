import { Bot, Cog } from "lucide-react";
import { cn } from "@/lib/utils";

/** `Deterministic` or `AI-assisted` (DESIGN.md §7.14; invariant 9). Required on every finding. */
export function SourceTag({
  source,
  className,
}: {
  source: "deterministic" | "llm";
  className?: string;
}) {
  return source === "llm" ? (
    <span className={cn("label text-fg inline-flex items-center gap-1 font-semibold", className)}>
      <Bot aria-hidden className="size-3.5" strokeWidth={2} />
      AI-assisted
    </span>
  ) : (
    <span className={cn("label text-fg-muted inline-flex items-center gap-1", className)}>
      <Cog aria-hidden className="size-3.5" strokeWidth={2} />
      Deterministic
    </span>
  );
}
