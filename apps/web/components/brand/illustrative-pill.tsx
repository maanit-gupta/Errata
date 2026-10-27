import { cn } from "@/lib/utils";

/** Marks insights computed from simulated activity (P13). */
export function IllustrativeDataPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "mono-label border-warning text-warning inline-flex h-5 items-center rounded-sm border px-1.5",
        className,
      )}
      title="Includes simulated review activity (make simulate-activity)"
    >
      Illustrative data
    </span>
  );
}
