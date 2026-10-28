import { cn } from "@/lib/utils";

/** The product name, used wherever the name is shown. */
export const PRODUCT_NAME = "Errata";
/** The one tagline, used wherever a tagline is shown (DESIGN.md §1). */
export const TAGLINE = "Pre-publication checks with cited rules.";

/**
 * Compact mark (collapsed sidebar, favicon): a bold "E" on a yellow tile with a 2px ink outline.
 * Decorative; the accessible name comes from the surrounding link or the sr-only text.
 */
export function ErrataMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      className={cn(
        "bg-highlight text-highlight-fg border-outline inline-flex shrink-0 items-center justify-center rounded-[6px] border-2 leading-none font-bold",
        className,
      )}
    >
      E
    </span>
  );
}

/**
 * Wordmark (DESIGN.md §6): the name "Errata" in bold sans with a yellow highlighter stroke under
 * it. `compact` shows the mark only, with the name for screen readers.
 */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact)
    return (
      <span className={cn("inline-flex", className)}>
        <ErrataMark />
        <span className="sr-only">{PRODUCT_NAME}</span>
      </span>
    );
  return (
    <span
      className={cn(
        "text-fg relative inline-flex text-[1.375rem] leading-none font-bold tracking-[-0.03em]",
        className,
      )}
    >
      <span className="relative z-10">{PRODUCT_NAME}</span>
      <span
        aria-hidden
        className="bg-highlight absolute inset-x-[-3px] bottom-[0.08em] z-0 h-[0.4em] rounded-[2px]"
      />
    </span>
  );
}
