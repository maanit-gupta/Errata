"use client";

import { FileWarning, Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { DataTable } from "@/components/brand/data-table";
import { Drawer } from "@/components/brand/drawer";
import { EmptyState } from "@/components/brand/empty-state";
import { IdCode } from "@/components/brand/id-badge";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { saveFact } from "@/lib/vault/actions";
import { toastResult } from "./use-action-toast";

export type FactRow = {
  id: string;
  code: string;
  kind: string;
  campaign: string | null;
  statement: string;
  value: unknown;
  required_disclaimer: string | null;
  valid_until: string | null;
  never_send: boolean;
};

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

/** Fact Vault table (DESIGN.md §6.6). Editing opens the drawer. */
export function FactsTable({ facts, now }: { facts: FactRow[]; now: string }) {
  const [editing, setEditing] = useState<FactRow | null>(null);
  return (
    <>
      <DataTable
        caption="Facts in the Fact Vault"
        rows={facts}
        rowKey={(f) => f.id}
        initialSort={{ key: "code", dir: "asc" }}
        empty={
          <EmptyState glyph="calendar-x" title="No facts yet">
            Import a facts CSV above. Dates, venues and fees are then checked deterministically.
          </EmptyState>
        }
        columns={[
          {
            key: "code",
            header: "Code",
            rowHeader: true,
            sortValue: (f) => f.code,
            cell: (f) => <IdCode code={f.code} />,
          },
          {
            key: "campaign",
            header: "Campaign",
            sortValue: (f) => f.campaign ?? "",
            cell: (f) => f.campaign ?? <span className="mono-label text-fg-faint">ORG-WIDE</span>,
          },
          {
            key: "kind",
            header: "Kind",
            sortValue: (f) => f.kind,
            cell: (f) => <span className="mono-label text-fg-muted">{f.kind}</span>,
          },
          {
            key: "statement",
            header: "Statement",
            className: "min-w-64",
            cell: (f) => f.statement,
          },
          {
            key: "value",
            header: "Value",
            cell: (f) => {
              const v = JSON.stringify(f.value);
              return (
                <code
                  title={JSON.stringify(f.value, null, 2)}
                  className="text-fg-muted block max-w-56 truncate font-mono text-xs"
                >
                  {v}
                </code>
              );
            },
          },
          {
            key: "disclaimer",
            header: "Disclaimer",
            cell: (f) =>
              f.required_disclaimer ? (
                <span
                  title={f.required_disclaimer}
                  className="text-fg-muted inline-flex items-center gap-1 text-xs"
                >
                  <FileWarning aria-hidden className="size-4" />
                  <span className="sr-only">Required disclaimer: {f.required_disclaimer}</span>
                </span>
              ) : (
                <span className="text-fg-faint">—</span>
              ),
          },
          {
            key: "expires",
            header: "Expires",
            sortValue: (f) => f.valid_until ?? "",
            cell: (f) => {
              const expired = f.valid_until !== null && f.valid_until < now;
              return (
                <span className="mono-id inline-flex items-center gap-1.5 whitespace-nowrap">
                  {f.valid_until
                    ? new Date(f.valid_until).toLocaleDateString("en-IN", { dateStyle: "medium" })
                    : "—"}
                  {expired ? (
                    <span className="mono-label bg-blocker-bg text-blocker rounded-sm px-1.5 py-0.5">
                      Expired
                    </span>
                  ) : null}
                </span>
              );
            },
          },
          {
            key: "never",
            header: "Never send",
            cell: (f) =>
              f.never_send ? (
                <span className="text-fg-muted inline-flex items-center gap-1 text-xs">
                  <Lock aria-hidden className="size-3.5" /> Yes
                </span>
              ) : (
                <span className="text-fg-faint text-xs">No</span>
              ),
          },
          {
            key: "edit",
            header: "",
            align: "right",
            cell: (f) => (
              <Button variant="secondary" size="sm" onClick={() => setEditing(f)}>
                Edit <span className="sr-only">{f.code}</span>
              </Button>
            ),
          },
        ]}
      />
      {editing ? (
        <FactEditor key={editing.id} fact={editing} onDone={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function FactEditor({ fact, onDone }: { fact: FactRow; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [statement, setStatement] = useState(fact.statement);
  const [value, setValue] = useState(JSON.stringify(fact.value ?? {}, null, 2));
  const [disclaimer, setDisclaimer] = useState(fact.required_disclaimer ?? "");
  const [validUntil, setValidUntil] = useState(toLocal(fact.valid_until));
  const [neverSend, setNeverSend] = useState(fact.never_send);
  const p = `fact-${fact.id}`;
  return (
    <Drawer
      open
      onClose={onDone}
      eyebrow={<IdCode code={fact.code} />}
      title="Edit fact"
      footer={
        <>
          <Button type="submit" form={`${p}-form`} disabled={pending}>
            {pending ? "Saving…" : `Save ${fact.code}`}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </>
      }
    >
      <form
        id={`${p}-form`}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveFact({
              id: fact.id,
              statement,
              value,
              required_disclaimer: disclaimer,
              valid_until: validUntil,
              never_send: neverSend,
            });
            toastResult(r);
            if (r.ok) onDone();
          });
        }}
      >
        <p className="text-fg-muted text-sm">
          {fact.campaign ? `Campaign: ${fact.campaign}` : "Org-wide fact"} · {fact.kind}
        </p>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-st`} className="text-sm font-medium">
            Statement
          </label>
          <Input id={`${p}-st`} value={statement} onChange={(e) => setStatement(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-val`} className="text-sm font-medium">
            Value (JSON)
          </label>
          <textarea
            id={`${p}-val`}
            rows={6}
            className={`${fieldClass} font-mono text-xs`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-dis`} className="text-sm font-medium">
            Required disclaimer
          </label>
          <Input
            id={`${p}-dis`}
            value={disclaimer}
            onChange={(e) => setDisclaimer(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-exp`} className="text-sm font-medium">
            Valid until
          </label>
          <Input
            id={`${p}-exp`}
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            role="switch"
            className="mt-0.5 size-5 accent-(--accent)"
            checked={neverSend}
            onChange={(e) => setNeverSend(e.target.checked)}
          />
          <span>
            <span className="inline-flex items-center gap-1 font-medium">
              <Lock aria-hidden className="size-3.5" /> Never send to AI
            </span>
            <span className="text-fg-faint block text-xs">
              Checked locally only; never included in an LLM prompt.
            </span>
          </span>
        </label>
      </form>
    </Drawer>
  );
}
