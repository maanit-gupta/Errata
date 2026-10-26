import { cn } from "@/lib/utils";

/** `1,240 / 2,000 words` (DESIGN.md §5): warning at 90%, blocker at 100% (SPEC MAX_WORDS). */
export function WordCounter({ count, max, id }: { count: number; max: number; id?: string }) {
  const tone = count > max ? "text-blocker" : count >= max * 0.9 ? "text-warning" : "text-fg-faint";
  return (
    <p id={id} className={cn("mono-id", tone)} aria-live="polite">
      {count.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")} words
      {count > max ? <span> · over the limit</span> : null}
    </p>
  );
}
