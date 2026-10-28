import type { ReactNode } from "react";
import { Spot, type SpotName } from "@/components/illustrations";
import { cn } from "@/lib/utils";

/** EmptyState (DESIGN.md §7.11): grey panel, spot illustration, bold title, one line, one action. */
export function EmptyState({
  glyph = "lens",
  title,
  children,
  action,
  className,
  headingLevel = 2,
}: {
  /** Spot illustration name (components/illustrations). */
  glyph?: SpotName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      className={cn(
        "bg-band-grey flex flex-col items-center justify-center gap-3 rounded-lg px-6 py-12 text-center",
        className,
      )}
    >
      <Spot name={glyph} className="w-28" />
      <H className="text-xl font-bold">{title}</H>
      {children ? <div className="text-fg-muted max-w-md text-[0.9375rem]">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
