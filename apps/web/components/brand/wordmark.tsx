import { PixelGlyph } from "@/components/brand/pixel-glyphs";
import { cn } from "@/lib/utils";

/** BrandLens wordmark (DESIGN.md §3): pixel lens + "Brand" in text, "Lens" muted. */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-normal", className)}>
      <PixelGlyph name="lens" size={18} />
      {compact ? (
        <span className="sr-only">BrandLens</span>
      ) : (
        <span>
          <span className="text-fg">Brand</span>
          <span className="text-fg-muted">Lens</span>
        </span>
      )}
    </span>
  );
}
