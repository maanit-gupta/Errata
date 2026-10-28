"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, Check, ChevronDown, Pencil, X } from "lucide-react";
import { useId, useState } from "react";
import { ConfidenceChip, HUMAN_CONFIDENCE } from "@/components/brand/confidence-chip";
import { DimensionLabel } from "@/components/brand/dimension";
import { IdBadge, type CitationKind, type CitationSource } from "@/components/brand/id-badge";
import { IntentCheckTag } from "@/components/brand/intent-check-tag";
import { SeverityBadge, type Severity } from "@/components/brand/severity-badge";
import { ColourSwatches } from "@/components/brand/colour-swatches";
import { SourceTag } from "@/components/brand/source-tag";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { DISMISS_REASONS } from "@/lib/drafts/intent";
import { parseSwatches } from "@/lib/drafts/swatches";
import { cn } from "@/lib/utils";

export type Citation = {
  code: string;
  kind: CitationKind;
  title?: string;
  text?: string;
  /** Popover content (rule body/summary, version, source page…). */
  source?: CitationSource;
};

export type FindingView = {
  id: string;
  dimension: string;
  severity: Severity;
  confidence: number;
  source: "deterministic" | "llm";
  quote: string;
  span: { start: number; end: number };
  /** What the finding points at: draft text, a region of an uploaded image, or its alt text. */
  target: "text" | "image" | "alt_text";
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  /** PDFs: the 1-based page the finding is on (P12). */
  page?: number | null;
  explanation: string;
  rewrite: string | null;
  status: "open" | "accepted" | "edited" | "dismissed" | "routed" | "superseded";
  dismiss_reason: string | null;
  citations: Citation[];
  model_version?: string | null;
  prompt_version?: string | null;
  resolved_at?: string | null;
  /** Display name of whoever resolved it (review page). */
  resolvedBy?: string | null;
};

export { HUMAN_CONFIDENCE };

type Props = {
  finding: FindingView;
  active: boolean;
  canAct: boolean;
  /** Image versions: fixes happen in the design file, so "Mark fixed" replaces accept/edit. */
  imageMode?: boolean;
  /** The finding's number on the image overlay (per page for PDFs). */
  marker?: number;
  /** Agency viewers: citations show the summary only. */
  summaryView?: boolean;
  /** Position in the list: findings fade in with a 60ms stagger. */
  index?: number;
  onFocus: (id: string | null, scroll?: boolean) => void;
  /** PDFs: turn to the finding's page and bring its box into view. */
  onShow?: (finding: FindingView) => void;
  /** Read-only views: a link (e.g. `#show-<id>`) that turns the PDF viewer to the finding. */
  showHref?: string;
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

const REASON_HELP: Record<string, string> = {
  approved_exception: "This use was signed off as an exception.",
  doesnt_apply: "This tells your brand team the rule may be unclear.",
  ai_wrong: "The finding is incorrect. It lowers this rule's clarity score.",
};

function ago(iso?: string | null): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

/**
 * FindingCard (DESIGN.md §6.3): header with severity + citation chips, quote, explanation, cites
 * row, fix block, actions, and a collapsed resolved state. A finding with no citation is never
 * rendered (invariant 1): the caller filters, and this component returns null as a backstop.
 */
export function FindingCard({
  finding: f,
  active,
  canAct,
  imageMode = false,
  marker,
  summaryView = false,
  index = 0,
  showHref,
  onFocus,
  onShow,
  onApply,
  onResolve,
}: Props) {
  const id = useId();
  const resolved = f.status !== "open";
  const [open, setOpen] = useState(!resolved && f.severity === "blocker");
  const [editing, setEditing] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [edited, setEdited] = useState(f.rewrite ?? f.quote);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (f.citations.length === 0) return null;

  const lowConfidence = f.confidence < HUMAN_CONFIDENCE;
  const acceptBlocked = !f.rewrite || lowConfidence;
  const acceptWhy = !f.rewrite
    ? f.severity === "blocker"
      ? "Blockers need a fix or a person: there's no safe suggested fix. Edit the text, route it, or dismiss with a reason."
      : "No suggested fix. Edit the text yourself, or dismiss with a reason."
    : lowConfidence
      ? `Needs a person: confidence ${f.confidence.toFixed(2)} is below 0.6, so it can't be accepted in one click.`
      : "";
  // In an image, only an alt-text suggestion can be applied here; anything else is fixed in the
  // design and re-checked when the new file is uploaded.
  const fixInDesign = imageMode && f.target !== "alt_text";
  const canRoute = f.dimension === "claims" && f.severity === "blocker";
  const codes = f.citations.map((c) => c.code).join(", ");
  // Measured colours only exist on image/PDF findings (contrast, palette ΔE).
  const swatches = f.target === "text" ? null : parseSwatches(f.explanation);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setEditing(false);
      setDismissing(false);
    } finally {
      setBusy(false);
    }
  };

  const meta =
    f.source === "llm"
      ? ["llm", f.model_version, f.prompt_version].filter(Boolean).join(" · ")
      : `deterministic · filters/${f.dimension}`;

  return (
    <li
      id={`finding-${f.id}`}
      data-finding={f.id}
      style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
      className={cn(
        "bg-elevated fade-in rounded-lg border-2 transition-colors",
        active ? "border-outline bg-hover" : "border-outline",
        resolved && "bg-canvas",
      )}
      onMouseEnter={() => onFocus(f.id)}
      onMouseLeave={() => onFocus(null)}
      // Scroll the highlight into view only for keyboard focus; a mouse-down scroll would move the
      // card before mouse-up and swallow the click.
      onFocus={(e) => onFocus(f.id, (e.target as HTMLElement).matches(":focus-visible"))}
    >
      <div className="flex items-start gap-2 p-3">
        <h3 className="m-0 min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => setOpen((o) => !o)}
            className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 rounded-sm text-left"
          >
            {marker ? (
              <span className="bg-fg text-canvas mono-id rounded-sm px-1.5">
                <span className="sr-only">
                  {f.page ? `Page ${f.page} marker ` : "Image marker "}
                </span>
                {marker}
              </span>
            ) : null}
            {f.page ? <span className="mono-id text-fg-faint">p.{f.page}</span> : null}
            {resolved ? (
              <span
                className={cn(
                  "mono-label",
                  f.status === "dismissed"
                    ? "text-fg-muted"
                    : f.status === "routed"
                      ? "text-accent-soft"
                      : "text-success",
                )}
              >
                {f.status === "dismissed" ? "✕" : f.status === "routed" ? "→" : "✓"}{" "}
                {STATUS_TEXT[f.status]}
                {f.status === "dismissed" && f.dismiss_reason
                  ? ` · ${f.dismiss_reason.replace("_", " ")}`
                  : ""}
              </span>
            ) : (
              <SeverityBadge severity={f.severity} />
            )}
            <span className="mono-id text-accent-soft">{codes}</span>
            <DimensionLabel dimension={f.dimension} />
            {resolved && f.resolvedBy ? (
              <span className="text-fg-faint text-xs">· by {f.resolvedBy}</span>
            ) : null}
            {resolved && f.resolved_at ? (
              <span className="text-fg-faint text-xs">· {ago(f.resolved_at)}</span>
            ) : null}
            <span
              className={cn("basis-full truncate text-sm", resolved ? "text-fg-muted" : "text-fg")}
            >
              <span className="font-mono text-[0.8125rem]">“{f.quote}”</span>
            </span>
          </button>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {resolved ? null : <ConfidenceChip confidence={f.confidence} source={f.source} />}
          <ChevronDown
            aria-hidden
            className={cn("text-fg-faint size-4 transition-transform", open && "rotate-180")}
          />
        </div>
      </div>

      {open ? (
        <div id={`${id}-body`} className="border-line space-y-3 border-t p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <SourceTag source={f.source} />
            {f.page && showHref ? (
              <a href={showHref} className="text-accent-soft text-xs underline underline-offset-4">
                Show on page {f.page}
              </a>
            ) : null}
            {f.page && onShow ? (
              <Button size="xs" variant="secondary" onClick={() => onShow(f)}>
                Show on page {f.page}
              </Button>
            ) : null}
          </div>
          <p className="text-fg-muted">{f.explanation}</p>
          {swatches ? <ColourSwatches swatches={swatches} /> : null}

          <div className="space-y-1.5">
            <p className="mono-label text-fg-faint flex items-center gap-2">
              Cites
              {summaryView ? <span className="text-fg-faint">· summary view</span> : null}
            </p>
            <ul className="space-y-1.5">
              {f.citations.map((c) => (
                <li key={c.code} className="flex items-start gap-2">
                  <IdBadge
                    code={c.code}
                    kind={c.kind}
                    source={c.source ?? { title: c.title, summary: c.text, summaryView }}
                  />
                  <span className="min-w-0 pt-0.5">
                    {c.title ? <span className="text-fg">{c.title}</span> : null}
                    {c.text ? <span className="text-fg-muted block text-xs">{c.text}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {f.rewrite && !editing ? (
            <div
              className="bg-code border-outline rounded-lg border-2 p-2.5"
              aria-label="Suggested fix"
              role="group"
            >
              <p className="mono-label text-fg-faint mb-1.5">Fix</p>
              <p className="font-mono text-[0.8125rem] leading-relaxed">
                <del className="bg-blocker-bg text-fg-muted decoration-blocker">{f.quote}</del>
                <span aria-hidden className="text-fg-faint">
                  {" "}
                  →{" "}
                </span>
                <ins className="bg-success-bg text-fg decoration-success underline decoration-1 underline-offset-2">
                  {f.rewrite}
                </ins>
              </p>
              {f.source === "llm" ? <IntentCheckTag className="mt-2" /> : null}
            </div>
          ) : null}

          {canAct && !resolved && editing ? (
            <div className="space-y-2">
              <label htmlFor={`${id}-edit`} className="font-medium">
                Your fix
              </label>
              <textarea
                id={`${id}-edit`}
                rows={3}
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                className={fieldClass}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !edited.trim()}
                  onClick={() => run(() => onApply(f, edited, "edited"))}
                >
                  Apply fix
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {canAct && !resolved && !editing ? (
            <div className="flex flex-wrap gap-2">
              {fixInDesign ? (
                <Button
                  size="sm"
                  disabled={busy}
                  aria-describedby={`${id}-design`}
                  onClick={() => run(() => onApply(f, "", "edited"))}
                >
                  <Check aria-hidden />
                  {f.page ? "Mark fixed in the PDF" : "Mark fixed in the image"}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={busy || acceptBlocked}
                    focusableWhenDisabled
                    aria-describedby={acceptWhy ? `${id}-why` : undefined}
                    onClick={() => run(() => onApply(f, f.rewrite ?? "", "accepted"))}
                  >
                    <Check aria-hidden /> Accept fix
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                  >
                    <Pencil aria-hidden /> Edit
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setDismissing(true)}
              >
                <X aria-hidden /> Dismiss
              </Button>
              {canRoute ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => onResolve(f, { status: "routed" }))}
                >
                  <ArrowRight aria-hidden /> Route to Legal
                </Button>
              ) : null}
              {fixInDesign ? (
                <p id={`${id}-design`} className="text-fg-faint basis-full text-xs">
                  Fix it in the design file, then upload the new {f.page ? "PDF" : "image"}: the
                  next check verifies it.
                </p>
              ) : acceptWhy ? (
                <p id={`${id}-why`} className="text-fg-faint basis-full text-xs">
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

          <p className="mono-id text-fg-faint text-[0.6875rem]">{meta}</p>
        </div>
      ) : null}

      <Dialog.Root open={dismissing} onOpenChange={setDismissing}>
        <Dialog.Portal>
          <Dialog.Backdrop className="bg-overlay fixed inset-0 z-40" />
          <Dialog.Popup className="bg-elevated border-outline fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border-2 p-5 outline-none">
            <Dialog.Title className="text-lg">Dismiss {codes}?</Dialog.Title>
            <Dialog.Description className="text-fg-muted text-sm">
              Pick a reason. Dismissals are audited and feed the rule&apos;s clarity score.
            </Dialog.Description>
            <fieldset className="space-y-2">
              <legend className="sr-only">Reason</legend>
              {DISMISS_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)",
                    reason === r.value
                      ? "border-accent bg-accent-deep"
                      : "border-line-strong hover:bg-hover",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="mt-1 accent-(--accent)"
                  />
                  <span>
                    <span className="block text-sm">{r.label}</span>
                    <span className="text-fg-muted block text-xs">{REASON_HELP[r.value]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-note`} className="text-sm font-medium">
                Note (optional)
              </label>
              <input
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
              <Button
                disabled={busy || !reason}
                focusableWhenDisabled
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
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </li>
  );
}
