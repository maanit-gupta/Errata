import { cn } from "@/lib/utils";

/**
 * The BrandLens mark (DESIGN.md §6): an outlined tile holding a lens ring with a yellow check tab.
 * Drawn from tokens so it follows the theme. Decorative unless `title` is given.
 */
export function LensMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="5"
        fill="var(--illo-paper)"
        stroke="var(--illo-ink)"
        strokeWidth="2"
      />
      <circle cx="14" cy="14" r="7" fill="none" stroke="var(--illo-ink)" strokeWidth="3" />
      <path
        d="M19 19 L24.5 24.5"
        stroke="var(--illo-ink)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle
        cx="14"
        cy="14"
        r="3"
        fill="var(--illo-yellow)"
        stroke="var(--illo-ink)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** BrandLens wordmark: the mark plus "BrandLens" in bold sans. `compact` shows the mark only. */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("text-fg inline-flex items-center gap-2", className)}>
      <LensMark />
      {compact ? (
        <span className="sr-only">BrandLens</span>
      ) : (
        <span className="text-lg leading-none font-bold tracking-[-0.02em]">BrandLens</span>
      )}
    </span>
  );
}
