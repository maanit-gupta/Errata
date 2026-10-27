"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

// P15: a failed server render shows a recoverable message instead of the framework error page.
// The digest lets us find the server log line without exposing the error text.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This page couldn't load"
      action={<Button onClick={reset}>Try again</Button>}
    >
      <p>
        Something went wrong on our side. Your drafts and decisions are saved. Try again, or reload
        the page in a minute.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs">Ref {error.digest}</p> : null}
    </EmptyState>
  );
}
