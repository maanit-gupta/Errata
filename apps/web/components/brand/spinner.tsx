"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Spinner + "Loading {thing}…" (DESIGN.md §11). No skeletons. Adds "Still working…" after 10s. */
export function Spinner({
  label,
  className,
  centered = false,
}: {
  label?: string;
  className?: string;
  centered?: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <span
      role="status"
      className={cn(
        "text-fg-muted inline-flex items-center gap-2 text-[0.8125rem]",
        centered && "flex w-full justify-center py-12",
        className,
      )}
    >
      <LoaderCircle aria-hidden className="spin size-3.5" strokeWidth={1.5} />
      {label ?? "Loading…"}
      {slow ? <span className="text-fg-faint">Still working…</span> : null}
    </span>
  );
}
