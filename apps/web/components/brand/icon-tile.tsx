import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon tile (DESIGN.md §7.5): a 40px ink square with a white icon. Decorative; the label is text. */
export function IconTile({
  Icon,
  className,
  size = "md",
}: {
  Icon: LucideIcon;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-accent text-accent-fg inline-flex shrink-0 items-center justify-center rounded-[8px]",
        size === "sm" ? "size-8" : "size-10",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} strokeWidth={2} />
    </span>
  );
}
