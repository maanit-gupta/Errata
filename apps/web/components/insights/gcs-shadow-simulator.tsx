"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { simulateRuleShadow, type ShadowResult } from "@/lib/insights/actions";

const pct = (x: number | null) => (x == null ? "–" : `${Math.round(x * 100)}%`);

/**
 * Hero 5: backtest the selected examples on the rule's recent findings before approving them.
 * Local embeddings only (no LLM); the result is a labelled projection, or "insufficient data".
 */
export function GcsShadowSimulator({
  ruleId,
  doExamples,
  dontExamples,
  includeSimulated,
  preview,
}: {
  ruleId: string;
  doExamples: string[];
  dontExamples: string[];
  includeSimulated: boolean;
  /** Kitchen sink only: render a result without calling the worker. */
  preview?: ShadowResult;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ShadowResult | null>(preview ?? null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      setError(null);
      const r = await simulateRuleShadow({ ruleId, doExamples, dontExamples, includeSimulated });
      if (r.ok) setResult(r.result);
      else {
        setResult(null);
        setError(r.error);
      }
    });

  return (
    <section
      aria-labelledby="shadow-h"
      className="border-outline space-y-2 rounded-lg border-2 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="shadow-h" className="text-sm font-semibold">
          Shadow backtest
        </h3>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || doExamples.length === 0}
          focusableWhenDisabled
          onClick={run}
        >
          {pending ? "Backtesting…" : "Run shadow backtest (last 30 findings)"}
        </Button>
      </div>
      <p className="text-fg-muted text-xs">
        Re-scores this rule&apos;s last 30 findings against the selected examples with the
        worker&apos;s local embedding model. No AI model call.{" "}
        {includeSimulated ? "Includes" : "Leaves out"} simulated history.
      </p>
      <div aria-live="polite" className="text-sm">
        {pending ? <p role="status">Backtesting…</p> : null}
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
        {result && !pending ? (
          result.status === "insufficient_data" ? (
            <p>
              <span className="font-semibold">Not enough data.</span> {result.note} Found{" "}
              {result.sample_size}.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p>
                <span className="mono-label border-line-strong mr-2 rounded-sm border px-1.5 py-0.5">
                  Projection
                </span>
                GCS {result.current_gcs ?? "–"} ({result.current_status}) →{" "}
                <span className="font-semibold">
                  {result.projected_gcs} ({result.projected_status})
                </span>
              </p>
              <p className="font-mono text-xs">
                Dismissals {pct(result.sample_dismissal_rate)} →{" "}
                {pct(result.projected_dismissal_rate)} · Low-confidence{" "}
                {pct(result.low_confidence_rate)} (held) · Projected GCS {result.current_gcs ?? "–"}{" "}
                → {result.projected_gcs ?? "–"}
              </p>
              <p className="text-fg-muted text-xs">
                On {result.sample_size} recent findings, {result.false_positives_removed} dismissed
                as “doesn&apos;t apply” would no longer be flagged.
                {result.true_positives_lost
                  ? ` ${result.true_positives_lost} accepted finding${result.true_positives_lost === 1 ? "" : "s"} would also stop being flagged: check the examples aren't too broad.`
                  : " No accepted findings would be lost."}
              </p>
              <p className="text-fg-faint text-xs">{result.note}</p>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
