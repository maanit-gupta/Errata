import type { Swatches } from "@/lib/drafts/swatches";

function Chip({ hex, label }: { hex: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="border-line-strong inline-block size-4 rounded-sm border"
        style={{ backgroundColor: hex }}
      />
      <span className="mono-id text-fg-muted text-xs">
        {label} {hex}
      </span>
    </span>
  );
}

/**
 * Measured colours on an image finding (DESIGN.md §6.11): a contrast sample rendered in the
 * measured pair, or the off-palette fill next to its nearest palette colour. The hex values and
 * numbers are always written out, so colour is never the only cue.
 */
export function ColourSwatches({ swatches }: { swatches: Swatches }) {
  if (swatches.kind === "contrast") {
    return (
      <div className="flex flex-wrap items-center gap-3" data-testid="swatches">
        <span
          aria-hidden
          className="border-line-strong inline-flex h-7 items-center rounded-sm border px-2 text-sm font-semibold"
          style={{ color: swatches.fg, backgroundColor: swatches.bg }}
        >
          Aa
        </span>
        <Chip hex={swatches.fg} label="text" />
        <Chip hex={swatches.bg} label="on" />
        <span className="mono-id text-xs">{swatches.ratio.toFixed(2)} : 1</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="swatches">
      <Chip hex={swatches.found} label="fill" />
      <span aria-hidden className="text-fg-faint">
        →
      </span>
      <Chip hex={swatches.nearest} label={swatches.nearestName} />
      <span className="mono-id text-xs">ΔE {swatches.deltaE.toFixed(1)}</span>
    </div>
  );
}
