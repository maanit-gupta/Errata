"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/brand/data-table";
import { Drawer } from "@/components/brand/drawer";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CampaignForm, type CampaignRow } from "./campaign-form";

export type CampaignView = CampaignRow & { id: string; facts: number };

const STATUS: Record<CampaignRow["status"], string> = {
  active: "bg-success-bg text-success border-transparent",
  planned: "border-line-strong text-fg-muted",
  ended: "border-line text-fg-faint",
};

export function CampaignStatusChip({ status }: { status: CampaignRow["status"] }) {
  return (
    <span
      className={cn(
        "mono-label inline-flex h-5 items-center rounded-sm border px-1.5",
        STATUS[status],
      )}
    >
      {status}
    </span>
  );
}

const date = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

/** Campaigns (DESIGN.md §6.6): table + create/edit drawer. */
export function CampaignsView({ campaigns }: { campaigns: CampaignView[] }) {
  const [editing, setEditing] = useState<CampaignView | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-fg-muted max-w-2xl text-sm">
          Facts and content carry their campaign, which is how Errata catches details copied from
          another campaign.
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden /> New campaign
        </Button>
      </div>
      <DataTable
        caption="Campaigns"
        rows={campaigns}
        rowKey={(c) => c.id}
        initialSort={{ key: "start", dir: "desc" }}
        empty={
          <EmptyState
            glyph="calendar"
            title="No campaigns yet"
            action={<Button onClick={() => setEditing("new")}>New campaign</Button>}
          >
            Create one so facts and drafts can be scoped to it.
          </EmptyState>
        }
        columns={[
          {
            key: "name",
            header: "Name",
            rowHeader: true,
            sortValue: (c) => c.name,
            cell: (c) => (
              <button
                type="button"
                onClick={() => setEditing(c)}
                className="text-fg text-left underline-offset-4 hover:underline focus-visible:underline"
              >
                {c.name}
              </button>
            ),
          },
          {
            key: "start",
            header: "Starts",
            sortValue: (c) => c.starts_on ?? "",
            cell: (c) => <span className="mono-id text-fg-muted">{date(c.starts_on)}</span>,
          },
          {
            key: "end",
            header: "Ends",
            sortValue: (c) => c.ends_on ?? "",
            cell: (c) => <span className="mono-id text-fg-muted">{date(c.ends_on)}</span>,
          },
          {
            key: "status",
            header: "Status",
            sortValue: (c) => c.status,
            cell: (c) => <CampaignStatusChip status={c.status} />,
          },
          {
            key: "facts",
            header: "Facts",
            align: "right",
            sortValue: (c) => c.facts,
            cell: (c) => <span className="mono-id">{c.facts}</span>,
          },
        ]}
      />
      {editing ? (
        <Drawer
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? "New campaign" : `Edit ${editing.name}`}
          eyebrow={editing === "new" ? null : <CampaignStatusChip status={editing.status} />}
        >
          <CampaignForm
            key={editing === "new" ? "new" : editing.id}
            campaign={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
