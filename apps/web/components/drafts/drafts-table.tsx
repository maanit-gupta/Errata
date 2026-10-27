"use client";

import { FileImage, FileText, FileType, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/brand/data-table";
import { EmptyState } from "@/components/brand/empty-state";
import { RiskMeter } from "@/components/brand/risk-meter";
import { SegmentedTabs } from "@/components/brand/segmented-tabs";
import { StateBadge, type ContentState } from "@/components/brand/state-badge";
import { Input } from "@/components/ui/input";

export type DraftRow = {
  id: string;
  title: string;
  campaign: string | null;
  channel: string;
  state: ContentState;
  routeTo: string | null;
  format: string;
  risk: number | null;
  open: { blocker: number; warning: number; suggestion: number };
  updatedAt: string;
};

const TABS: { value: string; label: string; states: ContentState[] | null }[] = [
  { value: "all", label: "All", states: null },
  { value: "draft", label: "Drafts", states: ["draft", "ai_check"] },
  { value: "revision", label: "Needs revision", states: ["needs_revision", "changes_requested"] },
  { value: "review", label: "In review", states: ["in_review", "specialist_review"] },
  { value: "approved", label: "Approved", states: ["approved"] },
  { value: "ready", label: "Publish-ready", states: ["publish_ready"] },
];

function relative(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const FORMAT_ICON = { image: FileImage, pdf: FileType } as Record<string, typeof FileText>;

/** Drafts overview (DESIGN.md §6.2): state tabs with counts, search, DataTable. */
export function DraftsTable({ rows }: { rows: DraftRow[] }) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.value === tab)!;
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!t.states || t.states.includes(r.state)) &&
        (!needle ||
          r.title.toLowerCase().includes(needle) ||
          (r.campaign ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, tab, q]);

  return (
    <SegmentedTabs
      label="Filter drafts by state"
      value={tab}
      onValueChange={setTab}
      tabs={TABS.map((t) => ({
        value: t.value,
        label: t.label,
        count: t.states ? rows.filter((r) => t.states!.includes(r.state)).length : rows.length,
      }))}
    >
      <div className="mb-4 max-w-sm">
        <label htmlFor="draft-search" className="sr-only">
          Search drafts by title or campaign
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="text-fg-faint absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id="draft-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or campaign"
            className="pl-9"
          />
        </div>
      </div>
      <DataTable
        caption="Your drafts"
        rows={filtered}
        rowKey={(r) => r.id}
        initialSort={{ key: "updated", dir: "desc" }}
        empty={
          <EmptyState glyph="lens" title="Nothing here" headingLevel={3}>
            No drafts match this filter.
          </EmptyState>
        }
        columns={[
          {
            key: "title",
            header: "Title",
            rowHeader: true,
            sortValue: (r) => r.title.toLowerCase(),
            cell: (r) => {
              const Icon = FORMAT_ICON[r.format] ?? FileText;
              return (
                <span className="flex items-center gap-2">
                  <Icon aria-hidden className="text-fg-faint size-4 shrink-0" strokeWidth={1.5} />
                  <Link
                    href={`/drafts/${r.id}`}
                    className="text-fg underline-offset-4 hover:underline focus-visible:underline"
                  >
                    {r.title}
                  </Link>
                </span>
              );
            },
          },
          {
            key: "campaign",
            header: "Campaign",
            sortValue: (r) => r.campaign ?? "",
            cell: (r) => <span className="text-fg-muted">{r.campaign}</span>,
          },
          {
            key: "channel",
            header: "Channel",
            cell: (r) => (
              <span className="bg-hover text-fg-muted rounded-sm px-1.5 py-0.5 text-xs whitespace-nowrap">
                {r.channel}
              </span>
            ),
          },
          {
            key: "state",
            header: "State",
            sortValue: (r) => r.state,
            cell: (r) => <StateBadge state={r.state} routeTo={r.routeTo} />,
          },
          {
            key: "open",
            header: "Open",
            sortValue: (r) => r.open.blocker * 100 + r.open.warning * 10 + r.open.suggestion,
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
            key: "risk",
            header: "Risk",
            sortValue: (r) => r.risk ?? -1,
            cell: (r) => (
              <RiskMeter size="sm" score={r.risk} blocker={r.open.blocker > 0 && !!r.routeTo} />
            ),
          },
          {
            key: "updated",
            header: "Updated",
            sortValue: (r) => r.updatedAt,
            cell: (r) => (
              <time
                dateTime={r.updatedAt}
                title={new Date(r.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                className="mono-id text-fg-faint whitespace-nowrap"
              >
                {relative(r.updatedAt)}
              </time>
            ),
          },
        ]}
      />
    </SegmentedTabs>
  );
}
