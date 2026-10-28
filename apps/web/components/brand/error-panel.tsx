"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Error state (DESIGN.md §11): what failed, a "Try again", and the request or run id in mono. */
export function ErrorPanel({
  title,
  children,
  onRetry,
  retryHref,
  reference,
  className,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  retryHref?: string;
  /** Run id, error code or digest, shown for support. */
  reference?: string | null;
  className?: string;
}) {
  return (
    <section
      role="alert"
      className={cn("border-danger bg-elevated space-y-3 rounded-lg border-2 p-5", className)}
    >
      <p className="flex items-center gap-2 font-bold">
        <CircleAlert aria-hidden className="text-danger size-4" />
        {title}
      </p>
      {children ? <div className="text-fg-muted text-sm">{children}</div> : null}
      <div className="flex flex-wrap items-center gap-3">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : retryHref ? (
          <a
            href={retryHref}
            className="text-fg text-sm font-semibold underline underline-offset-4"
          >
            Try again
          </a>
        ) : null}
        {reference ? <span className="mono-id text-fg-faint">ref {reference}</span> : null}
      </div>
    </section>
  );
}
