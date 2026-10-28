"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideExamples } from "@/lib/insights/actions";
import { cn } from "@/lib/utils";

export type GcsStatus = "unclear" | "watch" | "clear" | "insufficient";
export type SuggestedExample = { kind: "do" | "dont"; text: string; why?: string };
export type WatchRow = {
  ruleId: string;
  code: string;
  title: string;
  version: number;
  n: number;
  gcs: number | null;
  status: GcsStatus;
  /** The score of the version this one replaced, when it had one (before/after examples). */
  previous: { version: number; gcs: number | null; status: GcsStatus } | null;
  /** Pending suggestion for this version (empty `examples` = still generating). */
  suggestion: { id: string; examples: SuggestedExample[] } | null;
  /** Examples this version gained from an approved suggestion. */
  added: number;
};

const STATUS: Record<GcsStatus, { label: string; className: string }> = {
  unclear: { label: "UNCLEAR", className: "bg-blocker text-blocker-fg" },
  watch: { label: "watch", className: "border-warning text-warning border" },
  clear: { label: "clear", className: "text-success" },
  insufficient: { label: "insufficient data", className: "text-fg-faint italic normal-case" },
};

export function StatusBadge({ status }: { status: GcsStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("mono-label rounded-sm px-1.5 py-0.5 whitespace-nowrap", s.className)}>
      {s.label}
    </span>
  );
}

/**
 * Guideline watchlist (plan p.19): one row per approved rule with findings, worst first. An UNCLEAR
 * rule with generated examples opens a drawer (a modal `<dialog>`) where a brand admin keeps or
 * drops each example; approving makes the next version of the card, which is re-embedded.
 */
export function Watchlist({ rows, canDecide }: { rows: WatchRow[]; canDecide: boolean }) {
  const [open, setOpen] = useState<WatchRow | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const show = (row: WatchRow) => {
    setOpen(row);
    dialog.current?.showModal();
  };

  return (
    <>
      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Guideline watchlist: Guideline Clarity Score per rule, lowest first
          </caption>
          <thead className="bg-hover text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Rule
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                N
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                GCS
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ruleId} className="border-line border-t align-top">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="font-mono text-xs font-medium">{r.code}</span>{" "}
                  <span className="text-fg-muted font-mono text-xs">v{r.version}</span> {r.title}
                  {r.previous ? (
                    <span className="text-fg-muted block text-xs">
                      v{r.previous.version}: GCS {r.previous.gcs ?? "–"} (
                      {STATUS[r.previous.status].label})
                      {r.added
                        ? ` · v${r.version} added ${r.added} generated example${r.added === 1 ? "" : "s"}`
                        : ""}
                    </span>
                  ) : null}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{r.n}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{r.gcs ?? "–"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  {r.suggestion ? (
                    r.suggestion.examples.length ? (
                      <Button size="sm" variant="outline" onClick={() => show(r)}>
                        Review {r.suggestion.examples.length} examples
                        <span className="sr-only"> for {r.code}</span>
                      </Button>
                    ) : (
                      <span className="text-fg-muted text-xs">Generating examples…</span>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="examples-title"
        onClose={() => setOpen(null)}
        className="bg-elevated text-card-foreground border-line backdrop:bg-overlay m-0 ml-auto h-full max-h-none w-full max-w-lg border-l p-0"
      >
        {open?.suggestion ? (
          <SuggestionPanel
            key={open.suggestion.id}
            row={open}
            canDecide={canDecide}
            onDone={() => dialog.current?.close()}
          />
        ) : null}
      </dialog>
    </>
  );
}

function SuggestionPanel({
  row,
  canDecide,
  onDone,
}: {
  row: WatchRow;
  canDecide: boolean;
  onDone: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const examples = row.suggestion!.examples;
  const [keep, setKeep] = useState<number[]>(examples.map((_, i) => i));

  const decide = (indices: number[]) =>
    start(async () => {
      const r = await decideExamples({ suggestionId: row.suggestion!.id, keep: indices });
      if (r.ok) {
        toast.success(r.message);
        onDone();
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="flex h-full flex-col">
      <div className="border-line flex items-start justify-between gap-3 border-b p-4">
        <div>
          <p className="text-fg-muted font-mono text-xs">
            {row.code} · GCS {row.gcs} · UNCLEAR
          </p>
          <h2 id="examples-title" className="text-xl">
            Suggested examples for “{row.title}”
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Close
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        <p className="text-fg-muted">
          Creators often dismiss this rule&apos;s findings as “doesn&apos;t apply”. These examples
          were generated from the rule and those dismissed phrases (personal data redacted).
          Approved ones are added to the rule as a new version and used by the next checks.
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Examples to add</legend>
          {examples.map((e, i) => (
            <label
              key={i}
              htmlFor={`${id}-${i}`}
              className="border-line flex cursor-pointer gap-3 rounded-md border p-3"
            >
              <input
                id={`${id}-${i}`}
                type="checkbox"
                className="mt-1 size-4"
                disabled={!canDecide || pending}
                checked={keep.includes(i)}
                onChange={(ev) =>
                  setKeep((k) => (ev.target.checked ? [...k, i].sort() : k.filter((x) => x !== i)))
                }
              />
              <span>
                <span
                  className={cn(
                    "mr-2 rounded-sm px-1.5 py-0.5 font-mono text-xs uppercase",
                    e.kind === "do"
                      ? "bg-hover text-suggestion"
                      : "border-danger text-danger border",
                  )}
                >
                  {e.kind === "do" ? "Do" : "Don't"}
                </span>
                {e.text}
                {e.why ? <span className="text-fg-muted mt-1 block text-xs">{e.why}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="border-line space-y-2 border-t p-4">
        {canDecide ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || !keep.length} onClick={() => decide(keep)}>
              Approve {keep.length} example{keep.length === 1 ? "" : "s"}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => decide([])}>
              Reject all
            </Button>
          </div>
        ) : (
          <p className="text-fg-muted text-xs">Only a brand admin can approve examples.</p>
        )}
      </div>
    </div>
  );
}
