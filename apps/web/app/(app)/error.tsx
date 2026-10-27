"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/brand/error-panel";

/** Route error state (DESIGN.md §11): what failed, Try again, and a reference for support. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error", error.digest ?? error.message);
  }, [error]);
  return (
    <ErrorPanel
      title="Something went wrong loading this page"
      onRetry={reset}
      reference={error.digest ?? null}
      className="mx-auto max-w-2xl"
    >
      {error.message && !error.digest
        ? error.message
        : "The server couldn't load this view. Your work is saved."}
    </ErrorPanel>
  );
}
