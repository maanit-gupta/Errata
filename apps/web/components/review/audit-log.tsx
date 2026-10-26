"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/brand/data-table";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";

export type AuditRow = {
  id: number;
  at: string;
  actor: string;
  role: string | null;
  contentId: string | null;
  content: string | null;
  type: string;
  event: string;
  reason: string | null;
};

const ist = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  });

/** Global audit log (DESIGN.md §6.8): filter by content, actor or event type; export CSV. */
export function AuditLog({ rows }: { rows: AuditRow[] }) {
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [type, setType] = useState("");
  const actors = useMemo(() => [...new Set(rows.map((r) => r.actor))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.type))].sort(), [rows]);
  const shown = rows.filter(
    (r) =>
      (!q || (r.content ?? "").toLowerCase().includes(q.toLowerCase())) &&
      (!actor || r.actor === actor) &&
      (!type || r.type === type),
  );

  const exportCsv = () => {
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "time_ist,actor,role,content,event,reason",
      ...shown.map((r) =>
        [ist(r.at), r.actor, r.role, r.content, r.event, r.reason].map(esc).join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandlens-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64 space-y-1">
          <label htmlFor="audit-content" className="text-sm font-medium">
            Content
          </label>
          <Input
            id="audit-content"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title"
          />
        </div>
        <div className="w-48 space-y-1">
          <label htmlFor="audit-actor" className="text-sm font-medium">
            Actor
          </label>
          <select
            id="audit-actor"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className={fieldClass}
          >
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="w-48 space-y-1">
          <label htmlFor="audit-type" className="text-sm font-medium">
            Event type
          </label>
          <select
            id="audit-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={fieldClass}
          >
            <option value="">All events</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          className="ml-auto"
          onClick={exportCsv}
          disabled={!shown.length}
        >
          <Download aria-hidden /> Export CSV
        </Button>
      </div>
      <DataTable
        caption="Audit log, newest first"
        rows={shown}
        rowKey={(r) => String(r.id)}
        initialSort={{ key: "time", dir: "desc" }}
        empty={
          <EmptyState glyph="stamp" title="No events" headingLevel={3}>
            Every workflow transition and finding decision is recorded here.
          </EmptyState>
        }
        columns={[
          {
            key: "time",
            header: "Time (IST)",
            sortValue: (r) => r.at,
            cell: (r) => (
              <time dateTime={r.at} className="mono-id text-fg-muted whitespace-nowrap">
                {ist(r.at)}
              </time>
            ),
          },
          {
            key: "actor",
            header: "Actor",
            rowHeader: true,
            sortValue: (r) => r.actor,
            cell: (r) => (
              <span className="flex flex-wrap items-center gap-2">
                {r.actor}
                {r.role ? (
                  <span className="mono-label border-line-strong text-fg-faint rounded-sm border px-1">
                    {r.role}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "content",
            header: "Content",
            sortValue: (r) => r.content ?? "",
            cell: (r) =>
              r.contentId && r.content ? (
                <Link
                  href={`/review/${r.contentId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {r.content}
                </Link>
              ) : (
                <span className="text-fg-faint">—</span>
              ),
          },
          {
            key: "event",
            header: "Event",
            sortValue: (r) => r.event,
            cell: (r) => (
              <span className="mono-id text-accent-soft whitespace-nowrap">{r.event}</span>
            ),
          },
          {
            key: "reason",
            header: "Reason",
            cell: (r) => <span className="text-fg-muted">{r.reason ?? "—"}</span>,
          },
        ]}
      />
    </div>
  );
}
