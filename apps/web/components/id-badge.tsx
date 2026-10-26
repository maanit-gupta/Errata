import Link from "next/link";
import { cn } from "@/lib/utils";

type IdBadgeProps = {
  /** Rule, fact or WCAG id, e.g. `CL-03`, `F-112`, `WCAG 1.4.3`. */
  code: string;
  /** Opens the rule card or fact when set. */
  href?: string;
  /** Accessible description of what the id points to, e.g. "rule card". */
  kind?: string;
  className?: string;
};

/** Rule and fact IDs are first-class UI (CLAUDE.md): mono, bordered, clickable. */
export function IdBadge({ code, href, kind, className }: IdBadgeProps) {
  const classes = cn(
    "inline-flex items-center rounded-sm border border-foreground/25 bg-card px-1.5 py-0.5 font-mono text-xs font-medium tracking-tight text-foreground",
    href && "underline-offset-2 hover:border-foreground/60 hover:underline",
    className,
  );
  if (!href) return <span className={classes}>{code}</span>;
  return (
    <Link href={href} className={classes} aria-label={kind ? `${kind} ${code}` : undefined}>
      {code}
    </Link>
  );
}
