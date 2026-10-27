import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marketing buttons (DESIGN.md §4.1, §5): 44px, square, left-to-right violet wipe on hover with
 * a 2px chevron nudge. Reduced motion falls back to a colour change.
 */
export function Cta({
  href,
  children,
  variant = "primary",
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
}) {
  const cls = cn(
    "group relative inline-flex h-11 items-center gap-1.5 overflow-hidden px-5 text-sm font-medium",
    "before:absolute before:inset-0 before:origin-left before:scale-x-0 before:bg-(--accent) before:transition-transform before:duration-200 before:ease-[cubic-bezier(.2,.8,.2,1)] hover:before:scale-x-100 focus-visible:before:scale-x-100",
    variant === "primary"
      ? "bg-fg text-canvas hover:text-accent-fg"
      : "border-control text-fg hover:text-accent-fg border",
  );
  const inner = (
    <>
      <span className="relative">{children}</span>
      <ChevronRight
        aria-hidden
        className="relative size-4 transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </>
  );
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noreferrer">
      {inner}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
