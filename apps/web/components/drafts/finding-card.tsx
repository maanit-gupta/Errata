"use client";

import { useId, useState } from "react";
import { IdBadge } from "@/components/id-badge";
import { SeverityBadge, type Severity } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { DISMISS_REASONS } from "@/lib/drafts/intent";
import { cn } from "@/lib/utils";

export type Citation = {
  code: string;
  kind: "rule" | "fact" | "wcag";
  title?: string;
  text?: string;
};

export type FindingView = {
  id: string;
  dimension: string;
  severity: Severity;
  confidence: number;
  source: "deterministic" | "llm";
  quote: string;
  span: { start: number; end: number };
  explanation: string;
  rewrite: string | null;
  status: "open" | "accepted" | "edited" | "dismissed" | "routed" | "superseded";
  dismiss_reason: string | null;
  citations: Citation[];
};

export const HUMAN_CONFIDENCE = 0.6; // mirrors worker config.HUMAN_CONFIDENCE

type Props = {
  finding: FindingView;
  active: boolean;
  canAct: boolean;
  onFocus: (id: string | null, scroll?: boolean) => void;
  onApply: (finding: FindingView, text: string, status: "accepted" | "edited") => Promise<void>;
  onResolve: (
    finding: FindingView,
    patch:
      | { status: "dismissed"; dismiss_reason: string; dismiss_note?: string }
      | { status: "routed" | "open" },
  ) => Promise<void>;
};

const STATUS_TEXT: Record<FindingView["status"], string> = {
  open: "Open",
  accepted: "Fix accepted",
  edited: "Edited fix applied",
  dismissed: "Dismissed",
  routed: "Routed to legal",
  superseded: "No longer in the draft",
};

export function FindingCard({ finding: f, active, canAct, onFocus, onApply, onResolve }: Props) {
  const id = useId();
  const [open, setOpen] = useState(f.severity === "blocker" && f.status === "open");
  const [mode, setMode] = useState<"view" | "edit" | "dismiss">("view");
  const [edited, setEdited] = useState(f.rewrite ?? f.quote);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const lowConfidence = f.confidence < HUMAN_CONFIDENCE;
  const acceptBlocked = (f.severity === "blocker" && !f.rewrite) || lowConfidence || !f.rewrite;
  const acceptWhy = !f.rewrite
    ? "No suggested fix. Edit the text yourself, or dismiss with a reason."
    : lowConfidence
      ? "Needs human review: confidence is below 0.6, so it can't be accepted in one click."
      : "";
  const resolved = f.status !== "open";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setMode("view");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        "bg-card rounded-lg border transition-shadow",
        active ? "border-ring shadow-md" : "border-border",
        resolved && "bg-muted/30 border-dashed",
      )}
      onMouseEnter={() => onFocus(f.id)}
      onMouseLeave={() => onFocus(null)}
      // Scroll the highlight into view only for keyboard focus; a mouse-down scroll would move the
      // card before mouse-up and swallow the click.
      onFocus={(e) => onFocus(f.id, (e.target as HTMLElement).matches(":focus-visible"))}
    >
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full flex-wrap items-center gap-2 rounded-lg p-3 text-left font-sans text-sm"
        >
          <SeverityBadge severity={f.severity} />
          {f.citations.map((c) => (
            <span
              key={c.code}
              className="border-foreground/25 rounded-sm border px-1.5 py-0.5 font-mono text-xs"
            >
              {c.code}
            </span>
          ))}
          <span className="text-muted-foreground">{f.dimension}</span>
          {f.source === "llm" ? (
            <span className="border-border rounded-full border px-2 py-0.5 text-xs">
              AI-assisted
            </span>
          ) : null}
          {resolved ? (
            <span className="ml-auto text-xs font-medium">{STATUS_TEXT[f.status]}</span>
          ) : null}
          <span className="text-foreground basis-full truncate font-normal">“{f.quote}”</span>
        </button>
      </h3>

      {open ? (
        <div id={`${id}-body`} className="border-border space-y-3 border-t p-3 text-sm">
          <p>{f.explanation}</p>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="font-mono">confidence {f.confidence.toFixed(2)}</span>
            {lowConfidence ? (
              <span className="border-warning text-warning rounded-sm border px-1.5 font-medium">
                Needs human review
              </span>
            ) : null}
            {f.dismiss_reason ? (
              <span>· dismissed: {f.dismiss_reason.replace("_", " ")}</span>
            ) : null}
          </p>

          <ul className="space-y-2">
            {f.citations.map((c) => (
              <li key={c.code} className="bg-muted rounded-md p-2">
                <p className="flex items-center gap-2 font-medium">
                  <IdBadge
                    code={c.code}
                    kind={
                      c.kind === "fact"
                        ? "fact"
                        : c.kind === "wcag"
                          ? "WCAG criterion"
                          : "rule card"
                    }
                  />
                  {c.title}
                </p>
                {c.text ? <p className="text-muted-foreground mt-1">{c.text}</p> : null}
              </li>
            ))}
          </ul>

          {f.rewrite && mode === "view" ? (
            <p className="border-border rounded-md border p-2" aria-label="Suggested fix">
              <del className="text-muted-foreground decoration-accent-text">{f.quote}</del>
              <span aria-hidden> → </span>
              <ins className="font-medium no-underline">{f.rewrite}</ins>
            </p>
          ) : null}

          {canAct && !resolved && mode === "edit" ? (
            <div className="space-y-2">
              <label htmlFor={`${id}-edit`} className="font-medium">
                Your fix
              </label>
              <textarea
                id={`${id}-edit`}
                rows={3}
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                className="border-input bg-card w-full rounded-md border px-3 py-2"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !edited.trim()}
                  onClick={() => run(() => onApply(f, edited, "edited"))}
                >
                  Apply fix
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {canAct && !resolved && mode === "dismiss" ? (
            <fieldset className="space-y-2">
              <legend className="font-medium">Why dismiss it?</legend>
              {DISMISS_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              ))}
              <label htmlFor={`${id}-note`} className="block font-medium">
                Note (optional)
              </label>
              <input
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="border-input bg-card w-full rounded-md border px-3 py-1.5"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !reason}
                  onClick={() =>
                    run(() =>
                      onResolve(f, {
                        status: "dismissed",
                        dismiss_reason: reason,
                        dismiss_note: note || undefined,
                      }),
                    )
                  }
                >
                  Dismiss finding
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                  Cancel
                </Button>
              </div>
            </fieldset>
          ) : null}

          {canAct && !resolved && mode === "view" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || acceptBlocked}
                aria-describedby={acceptWhy ? `${id}-why` : undefined}
                onClick={() => run(() => onApply(f, f.rewrite ?? "", "accepted"))}
              >
                Accept fix
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode("edit")}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setMode("dismiss")}
              >
                Dismiss
              </Button>
              {f.dimension === "claims" && f.severity === "blocker" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => onResolve(f, { status: "routed" }))}
                >
                  Route to Legal
                </Button>
              ) : null}
              {acceptWhy ? (
                <p id={`${id}-why`} className="text-muted-foreground basis-full text-xs">
                  {acceptWhy}
                </p>
              ) : null}
            </div>
          ) : null}
          {canAct && (f.status === "dismissed" || f.status === "routed") ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => onResolve(f, { status: "open" }))}
            >
              Reopen
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
