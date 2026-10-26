"use client";

import { Fragment, useState, useTransition } from "react";
import { IdCode } from "@/components/brand/id-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function FactsTable({ facts, now }: { facts: FactRow[]; now: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="border-border bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Facts in the Fact Vault</caption>
        <thead className="border-border bg-muted/60 border-b">
          <tr>
            {[
              "Code",
              "Campaign",
              "Kind",
              "Statement",
              "Value",
              "Disclaimer",
              "Expires",
              "Never send",
              "",
            ].map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                {h || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => {
            const expired = f.valid_until !== null && f.valid_until < now;
            return (
              <Fragment key={f.id}>
                <tr className="border-border border-b align-top last:border-0">
                  <th scope="row" className="px-3 py-2">
                    <IdCode code={f.code} />
                  </th>
                  <td className="px-3 py-2">
                    {f.campaign ?? <span className="text-muted-foreground">Org-wide</span>}
                  </td>
                  <td className="px-3 py-2">{f.kind}</td>
                  <td className="px-3 py-2">{f.statement}</td>
                  <td className="px-3 py-2">
                    <pre className="max-w-xs overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                      {JSON.stringify(f.value, null, 2)}
                    </pre>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs">{f.required_disclaimer ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {f.valid_until
                      ? new Date(f.valid_until).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : "—"}
                    {expired ? (
                      <span className="border-accent-text text-accent-text ml-1 rounded-sm border px-1 font-mono text-[0.7rem] uppercase">
                        Expired
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{f.never_send ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-expanded={editing === f.id}
                      onClick={() => setEditing(editing === f.id ? null : f.id)}
                    >
                      {editing === f.id ? "Cancel" : "Edit"}{" "}
                      <span className="sr-only">{f.code}</span>
                    </Button>
                  </td>
                </tr>
                {editing === f.id ? (
                  <tr className="border-border bg-muted/40 border-b">
                    <td colSpan={9} className="px-3 py-3">
                      <FactEditor fact={f} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
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
    <form
      className="grid gap-3 md:grid-cols-2"
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
      <div className="space-y-1">
        <label htmlFor={`${p}-st`} className="text-sm font-medium">
          Statement
        </label>
        <Input id={`${p}-st`} value={statement} onChange={(e) => setStatement(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${p}-dis`} className="text-sm font-medium">
          Required disclaimer
        </label>
        <Input id={`${p}-dis`} value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${p}-val`} className="text-sm font-medium">
          Value (JSON)
        </label>
        <textarea
          id={`${p}-val`}
          rows={4}
          className="border-input bg-card w-full rounded-md border px-3 py-2 font-mono text-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={neverSend}
            onChange={(e) => setNeverSend(e.target.checked)}
          />
          Never send to an LLM
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Save {fact.code}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
