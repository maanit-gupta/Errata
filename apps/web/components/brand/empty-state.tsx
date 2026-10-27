import type { ReactNode } from "react";
import { PixelGlyph, type GlyphName } from "@/components/brand/pixel-glyphs";
import { cn } from "@/lib/utils";

/** EmptyState (DESIGN.md §5): pixel glyph, H3, one muted line, one primary action. */
export function EmptyState({
  glyph = "lens",
  title,
  children,
  action,
  className,
  headingLevel = 2,
}: {
  glyph?: GlyphName;
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
        "border-line bg-elevated flex flex-col items-center justify-center gap-3 rounded-md border px-6 py-14 text-center",
        className,
      )}
    >
      <PixelGlyph name={glyph} size={48} />
      <H className="text-xl">{title}</H>
      {children ? <div className="text-fg-muted max-w-md text-sm">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
