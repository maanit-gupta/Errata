import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className="text-muted-foreground size-8" strokeWidth={1.5} />
      ) : null}
      <h2 className="font-heading text-xl">{title}</h2>
      {children ? <div className="text-muted-foreground max-w-md text-sm">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
