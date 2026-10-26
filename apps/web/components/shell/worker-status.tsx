"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "ok" | "down" | "unknown" | "checking";

/** `● worker ok` / `● worker down` (DESIGN.md §6.0), polled every 60s. */
export function WorkerStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("checking");
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/worker-status", { cache: "no-store" });
        const body = (await res.json()) as { status: Status };
        if (alive) setStatus(body.status);
      } catch {
        if (alive) setStatus("down");
      }
    };
    void poll();
    const t = setInterval(poll, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const label =
    status === "ok"
      ? "worker ok"
      : status === "down"
        ? "worker down"
        : status === "unknown"
          ? "worker n/a"
          : "worker …";
  return (
    <span
      className="mono-id text-fg-faint inline-flex items-center gap-1.5"
      title={`Status: ${label}`}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "ok" ? "bg-success" : status === "down" ? "bg-danger" : "bg-fg-faint",
        )}
      />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
