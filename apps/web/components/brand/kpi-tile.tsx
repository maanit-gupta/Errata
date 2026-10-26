import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** KpiTile (DESIGN.md §5): mono eyebrow, 40px light number, delta line, optional sparkline. */
export function KpiTile({
  label,
  value,
  delta,
  sparkline,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  /** Values for a 1px violet polyline. */
  sparkline?: number[];
  className?: string;
}) {
  return (
    <div
      className={cn("border-line bg-elevated flex flex-col gap-2 rounded-md border p-4", className)}
    >
      <p className="mono-label text-fg-faint">{label}</p>
      <p className="text-[2.5rem] leading-none font-light tracking-tight">{value}</p>
      {delta ? <p className="text-fg-muted text-xs">{delta}</p> : null}
      {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : null}
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${24 - ((v - min) / span) * 22 - 1}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("h-6 w-full", className)}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
