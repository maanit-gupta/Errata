"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { DIMENSIONS, type Dimension } from "@/components/brand/dimension";
import { IdCode } from "@/components/brand/id-badge";
import { SeverityBadge, type Severity } from "@/components/brand/severity-badge";
import { Button } from "@/components/ui/button";
import { approveRuleCards } from "@/lib/vault/actions";
import { cn } from "@/lib/utils";
import { toastResult } from "./use-action-toast";

export type RuleRow = {
  id: string;
  code: string;
  version: number;
  dimension: string;
  title: string;
  summary: string;
  severity: Severity;
  status: "draft" | "approved" | "archived";
  source_page: number | null;
  never_send: boolean;
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  tone: "Tone and voice",
  terms: "Terminology",
  claims: "Claims and compliance",
  facts: "Facts",
  visual: "Visual",
  access: "Accessibility",
};

export function RuleStatusChip({ status }: { status: RuleRow["status"] }) {
  const styles = {
    draft: "border-warning text-warning",
    approved: "border-transparent bg-success-bg text-success",
    archived: "border-line text-fg-faint",
  }[status];
  return (
    <span
      className={cn("mono-label inline-flex h-5 items-center rounded-sm border px-1.5", styles)}
    >
      {status}
    </span>
  );
}

/** Rule cards grouped by dimension (DESIGN.md §6.6), with the F01 bulk-approve bar for drafts. */
export function RuleCardList({ rules, statusParam }: { rules: RuleRow[]; statusParam: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const drafts = rules.filter((r) => r.status === "draft");
  const groups = (Object.keys(DIMENSION_LABELS) as Dimension[])
    .map((dim) => ({ dim, rules: rules.filter((r) => r.dimension === dim) }))
    .filter((g) => g.rules.length);
  const bulk = selected.size ? [...selected] : drafts.map((d) => d.id);

  const approve = (ids: string[]) =>
    start(async () => {
      toastResult(await approveRuleCards(ids));
      setSelected(new Set());
    });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-8">
      {drafts.length ? (
        <div className="border-outline bg-band-pink sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-lg border-2 p-3">
          <p className="mr-auto text-sm">
            <span className="mono-id">{drafts.length}</span> draft{" "}
            {drafts.length === 1 ? "rule needs" : "rules need"} review. Drafts aren&apos;t used in
            checks until approved.
          </p>
          <Button disabled={pending} onClick={() => approve(bulk)}>
            {pending
              ? "Approving…"
              : `Approve ${bulk.length} rule card${bulk.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : null}

      {groups.map((g) => {
        const D = DIMENSIONS[g.dim];
        return (
          <section key={g.dim} aria-labelledby={`dim-${g.dim}`}>
            <h2
              id={`dim-${g.dim}`}
              className="mono-label text-fg-faint mb-2 flex items-center gap-2"
            >
              <D.Icon aria-hidden className="size-3.5" strokeWidth={1.5} />
              {DIMENSION_LABELS[g.dim]}
              <span className="text-fg-faint">· {g.rules.length}</span>
            </h2>
            <ul className="divide-line border-outline bg-elevated divide-y rounded-lg border-2">
              {g.rules.map((r) => (
                <li
                  key={r.id}
                  className="hover:bg-hover flex flex-wrap items-start gap-3 p-4 transition-colors"
                >
                  {r.status === "draft" ? (
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-(--accent)"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.code} ${r.title}`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <IdCode code={r.code} />
                      <SeverityBadge severity={r.severity} />
                      <RuleStatusChip status={r.status} />
                      <span className="mono-id text-fg-faint">v{r.version}</span>
                      {r.source_page ? (
                        <span className="mono-id text-fg-faint">p.{r.source_page}</span>
                      ) : null}
                      {r.never_send ? (
                        <span className="text-fg-muted inline-flex items-center gap-1 text-xs">
                          <Lock aria-hidden className="size-3.5" />
                          <span>never sent to AI</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-fg">{r.title}</p>
                    <p className="text-fg-muted text-sm">{r.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "draft" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => approve([r.id])}
                      >
                        Approve <span className="sr-only">{r.code}</span>
                      </Button>
                    ) : null}
                    <Link
                      href={`/vault?tab=rules&status=${statusParam}&card=${r.id}`}
                      scroll={false}
                      className="border-control hover:bg-hover inline-flex h-8 items-center rounded-sm border-2 px-2.5 text-sm"
                    >
                      {r.status === "archived" ? "View" : "Edit"}
                      <span className="sr-only">&nbsp;{r.code}</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
