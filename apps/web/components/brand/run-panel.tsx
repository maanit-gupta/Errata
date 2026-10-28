"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RunStatus = "queued" | "running" | "done" | "failed";

export type RunSummary = {
  id: string;
  status: RunStatus;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  /** `review_runs.timings` as written by the worker. */
  timings?: Record<string, unknown> | null;
  degraded?: boolean;
  errorCode?: string | null;
  findings?: number;
  piiRedacted?: number;
};

const STAGES: [key: string, label: string][] = [
  ["ingest", "01 ingest"],
  ["protect", "02 protect"],
  ["filters", "03 filters"],
  ["retrieve", "04 retrieve"],
  ["llm", "05 llm pass"],
];

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

/** Log lines for a run, from its status and the worker's timings (DESIGN.md §4.1 run log). */
export function runLog(run: RunSummary): {
  lines: string[];
  final?: string;
  gateDrops: number;
  llmCalls?: number;
  totalMs?: number;
} {
  const t = run.timings ?? {};
  const gate = t.gate && typeof t.gate === "object" ? (t.gate as Record<string, number>) : {};
  const gateDrops = Object.values(gate).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
  const llmCalls = num(t.llm_calls);
  const totalMs = num(t.total);
  const lines: string[] = [];
  if (run.status === "queued") lines.push("[00 queue] waiting for a worker");
  for (const [key, label] of STAGES) {
    const ms = num(t[key]);
    if (ms == null) continue;
    if (key === "llm") {
      lines.push(
        run.degraded
          ? `[${label}] skipped · provider unavailable`
          : `[${label}] ${llmCalls ?? 1} call${llmCalls === 1 ? "" : "s"} · ${ms}ms`,
      );
    } else lines.push(`[${label}] ${ms}ms`);
  }
  if (run.status === "done" || Object.keys(gate).length) {
    lines.push(`[06 citation gate] ${gateDrops} dropped`);
  }
  if (run.status === "running" && lines.length === 0) lines.push("[01 ingest] parsing draft");
  let final: string | undefined;
  if (run.status === "done") {
    final = `✓ done · ${run.findings ?? 0} finding${run.findings === 1 ? "" : "s"} · ${gateDrops} dropped by gate${
      totalMs != null ? ` · ${(totalMs / 1000).toFixed(1)}s` : ""
    }`;
  } else if (run.status === "failed") {
    final = `✕ failed · ${run.errorCode ?? "unknown_error"}`;
  }
  return { lines, final, gateDrops, llmCalls, totalMs };
}

/**
 * RunPanel (DESIGN.md §5): mono header with run id, provider, model and prompt version; the
 * streaming stage log; footer chips. Collapsible.
 */
export function RunPanel({
  run,
  banner,
  defaultOpen = true,
  traceHref,
}: {
  run: RunSummary;
  /** DegradedBanner or an error panel, shown above the log. */
  banner?: ReactNode;
  defaultOpen?: boolean;
  /** Admin-only Langfuse link in development. */
  traceHref?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const { lines, final, gateDrops, llmCalls, totalMs } = runLog(run);
  const active = run.status === "queued" || run.status === "running";
  const header = [
    `RUN ${run.id.slice(0, 4)}`,
    run.provider ?? (active ? "…" : "deterministic"),
    run.model,
    run.promptVersion,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="border-outline bg-code rounded-lg border-2" aria-label="Check run">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-log`}
          onClick={() => setOpen((o) => !o)}
          className="text-fg flex h-11 w-full items-center gap-2 px-4 text-left"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              active
                ? "bg-highlight border-outline border"
                : run.status === "failed"
                  ? "bg-danger"
                  : "bg-success",
            )}
            aria-hidden
          />
          <span className="text-sm font-bold">Check run</span>
          <span className="mono-id text-fg-muted min-w-0 flex-1 truncate">{header}</span>
          {traceHref ? (
            <a
              href={traceHref}
              target="_blank"
              rel="noreferrer"
              className="text-fg text-sm underline underline-offset-4"
              onClick={(e) => e.stopPropagation()}
            >
              Trace ↗
            </a>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
      </h3>
      {open ? (
        <div id={`${id}-log`} className="border-outline space-y-2 border-t-2 px-4 py-3">
          {banner}
          <ol className="font-mono text-[0.78125rem] leading-[1.6]">
            {lines.map((l, i) => (
              <li key={i} className="text-fg-muted fade-in">
                {l}
                {active && i === lines.length - 1 ? (
                  <span aria-hidden className="cursor-blink text-fg ml-1">
                    ▮
                  </span>
                ) : null}
              </li>
            ))}
            {final ? (
              <li
                className={cn("fade-in", run.status === "failed" ? "text-danger" : "text-success")}
              >
                {final}
              </li>
            ) : null}
          </ol>
          {run.status === "done" || run.status === "failed" ? (
            <ul className="flex flex-wrap gap-1.5 pb-1" aria-label="Run summary">
              {run.piiRedacted != null ? <Chip>PII redacted {run.piiRedacted}</Chip> : null}
              <Chip>gate drops {gateDrops}</Chip>
              <Chip title={llmCalls === 2 ? "Second sample confirmed a blocker" : undefined}>
                LLM calls {run.degraded ? 0 : (llmCalls ?? 0)}
              </Chip>
              {totalMs != null ? <Chip>{(totalMs / 1000).toFixed(1)}s</Chip> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <li
      title={title}
      className="mono-id border-line text-fg-muted rounded-sm border-2 px-1.5 py-0.5"
    >
      {children}
    </li>
  );
}
