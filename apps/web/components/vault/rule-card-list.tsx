"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { IdBadge } from "@/components/id-badge";
import { SeverityBadge, type Severity } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { approveRuleCards } from "@/lib/vault/actions";
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
};

const DIMENSION_LABELS: Record<string, string> = {
  tone: "Tone and voice",
  terms: "Terminology",
  claims: "Claims and compliance",
  facts: "Facts",
  visual: "Visual",
  access: "Accessibility",
};

export function RuleCardList({ rules, statusParam }: { rules: RuleRow[]; statusParam: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const drafts = rules.filter((r) => r.status === "draft");
  const groups = Object.entries(DIMENSION_LABELS)
    .map(([dim, label]) => ({ dim, label, rules: rules.filter((r) => r.dimension === dim) }))
    .filter((g) => g.rules.length);

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
        <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <p className="mr-auto text-sm">
            <strong>{drafts.length}</strong> draft{" "}
            {drafts.length === 1 ? "rule needs" : "rules need"} review. Drafts aren&apos;t used in
            checks until approved.
          </p>
          <Button
            variant="outline"
            disabled={pending || selected.size === 0}
            onClick={() => approve([...selected])}
          >
            Approve selected ({selected.size})
          </Button>
          <Button disabled={pending} onClick={() => approve(drafts.map((d) => d.id))}>
            Approve all drafts
          </Button>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.dim} aria-labelledby={`dim-${g.dim}`}>
          <h2 id={`dim-${g.dim}`} className="font-heading mb-3 text-xl">
            {g.label}
          </h2>
          <ul className="divide-border border-border bg-card divide-y rounded-lg border">
            {g.rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 p-4">
                {r.status === "draft" ? (
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--vermilion)]"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.code} ${r.title}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <IdBadge code={r.code} />
                    <span className="text-muted-foreground font-mono text-xs">v{r.version}</span>
                    <SeverityBadge severity={r.severity} />
                    <StatusPill status={r.status} />
                    {r.source_page ? (
                      <span className="text-muted-foreground text-xs">
                        guide p. {r.source_page}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-muted-foreground text-sm">{r.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "draft" ? (
                    <Button size="sm" disabled={pending} onClick={() => approve([r.id])}>
                      Approve <span className="sr-only">{r.code}</span>
                    </Button>
                  ) : null}
                  <Link
                    href={`/vault?tab=rules&status=${statusParam}&card=${r.id}`}
                    scroll={false}
                    className="border-border hover:bg-muted inline-flex h-7 items-center rounded-md border px-2.5 text-sm font-medium"
                  >
                    {r.status === "archived" ? "View" : "Edit"}{" "}
                    <span className="sr-only">&nbsp;{r.code}</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: RuleRow["status"] }) {
  const styles = {
    draft: "border-warning text-warning",
    approved: "border-success text-success",
    archived: "border-border text-muted-foreground",
  }[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}
