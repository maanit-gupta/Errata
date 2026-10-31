import { Clock } from "lucide-react";

/**
 * "AI check pending" (R3): the rule-based findings are in; the AI pass is waiting for model
 * capacity and will fill in by itself (Realtime). Not an error, so it's info-styled, and the run
 * isn't routed to reviewers until it completes.
 */
export function AiPendingBanner({
  attempt,
  maxAttempts,
  nextAt,
}: {
  /** LLM attempts that hit a rate limit so far (review_runs.llm_attempts). */
  attempt: number;
  maxAttempts: number;
  /** review_runs.llm_next_at */
  nextAt: string | null;
}) {
  const when = nextAt
    ? `around ${new Date(nextAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST`
    : "shortly";
  return (
    <div
      role="status"
      className="border-info bg-elevated flex flex-wrap items-start gap-3 rounded-lg border-2 px-4 py-3 text-sm"
    >
      <Clock aria-hidden className="text-info mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-bold">AI check pending.</span> Rule-based checks are done and shown
        below. The AI check is waiting for model capacity and will add its findings here by itself
        (next try {when}, attempt {Math.min(attempt + 1, maxAttempts)} of {maxAttempts}). You
        don&apos;t need to resubmit. Reviewers see this draft once the AI check finishes.
      </p>
    </div>
  );
}
