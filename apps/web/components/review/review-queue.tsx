"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/brand/data-table";
import { EmptyState } from "@/components/brand/empty-state";
import { RiskMeter } from "@/components/brand/risk-meter";
import { SegmentedTabs } from "@/components/brand/segmented-tabs";

export type QueueRow = {
  id: string;
  title: string;
  campaign: string | null;
  route: string;
  risk: number | null;
  open: { blocker: number; warning: number; suggestion: number };
  creator: string;
  waitingSince: string;
  reason: string;
  mine: boolean;
};

const ROUTE_LABEL: Record<string, string> = {
  manager: "Manager",
  legal: "Legal",
  a11y: "A11y",
  brand: "Brand",
};

function age(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** Review queue (DESIGN.md §6.4): risk-sorted, tabs by route, routing reason under each title. */
export function ReviewQueue({
  rows,
  tabs,
}: {
  rows: QueueRow[];
  tabs: ("mine" | "legal" | "a11y" | "brand" | "all")[];
}) {
  const [tab, setTab] = useState<string>(tabs[0]);
  const filter = (t: string) =>
    t === "mine"
      ? rows.filter((r) => r.mine)
      : t === "all"
        ? rows
        : rows.filter((r) => r.route === t);
  const label = {
    mine: "For me",
    legal: "Legal",
    a11y: "Accessibility",
    brand: "Brand",
    all: "All",
  };
  return (
    <SegmentedTabs
      label="Review queues"
      value={tab}
      onValueChange={setTab}
      tabs={tabs.map((t) => ({ value: t, label: label[t], count: filter(t).length }))}
    >
      <DataTable
        caption="Content waiting for review, sorted by risk then age"
        rows={filter(tab)}
        rowKey={(r) => r.id}
        initialSort={{ key: "risk", dir: "desc" }}
        empty={
          <EmptyState glyph="stamp" title="Nothing to review" headingLevel={3}>
            Drafts that pass the AI check and are routed here appear sorted by risk score.
          </EmptyState>
        }
        columns={[
          {
            key: "risk",
            header: "Risk",
            sortValue: (r) =>
              (r.risk ?? -1) * 1e7 + (Date.now() - new Date(r.waitingSince).getTime()) / 1e5,
            cell: (r) => <RiskMeter size="sm" score={r.risk} blocker={r.open.blocker > 0} />,
          },
          {
            key: "title",
            header: "Title",
            rowHeader: true,
            sortValue: (r) => r.title.toLowerCase(),
            cell: (r) => (
              <span className="block min-w-56 py-1">
                <Link
                  href={`/review/${r.id}`}
                  className="text-fg underline-offset-4 hover:underline focus-visible:underline"
                >
                  {r.title}
                </Link>
                <span className="text-fg-faint block font-mono text-[0.6875rem]">{r.reason}</span>
              </span>
            ),
          },
          {
            key: "route",
            header: "Route",
            sortValue: (r) => r.route,
            cell: (r) => (
              <span className="mono-label bg-accent-deep text-accent-soft rounded-sm px-1.5 py-0.5">
                → {ROUTE_LABEL[r.route] ?? r.route}
              </span>
            ),
          },
          {
            key: "open",
            header: "Open",
            cell: (r) => (
              <span className="mono-id inline-flex gap-1.5 whitespace-nowrap">
                <span className="sr-only">
                  {r.open.blocker} blockers, {r.open.warning} warnings, {r.open.suggestion}{" "}
                  suggestions
                </span>
                <span aria-hidden className={r.open.blocker ? "text-blocker" : "text-fg-faint"}>
                  {r.open.blocker}B
                </span>
                <span aria-hidden className={r.open.warning ? "text-warning" : "text-fg-faint"}>
                  {r.open.warning}W
                </span>
                <span aria-hidden className="text-fg-faint">
                  {r.open.suggestion}S
                </span>
              </span>
            ),
          },
          {
            key: "creator",
            header: "Creator",
            sortValue: (r) => r.creator,
            cell: (r) => <span className="text-fg-muted">{r.creator}</span>,
          },
          {
            key: "campaign",
            header: "Campaign",
            sortValue: (r) => r.campaign ?? "",
            cell: (r) => <span className="text-fg-muted">{r.campaign}</span>,
          },
          {
            key: "waiting",
            header: "Waiting",
            sortValue: (r) => -new Date(r.waitingSince).getTime(),
            cell: (r) => <span className="mono-id text-fg-faint">{age(r.waitingSince)}</span>,
          },
        ]}
      />
    </SegmentedTabs>
  );
}
