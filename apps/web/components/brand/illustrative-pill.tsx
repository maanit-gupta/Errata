import { cn } from "@/lib/utils";

/** Marks insights computed from simulated activity (P13). Pink chip, ink text. */
export function IllustrativeDataPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "label border-outline bg-accent-deep text-fg inline-flex h-6 items-center rounded-sm border-2 px-2 font-semibold",
        className,
      )}
      title="Includes simulated review activity (make simulate-activity)"
    >
      Illustrative data
    </span>
  );
}
