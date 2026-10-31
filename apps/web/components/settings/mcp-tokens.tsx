"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/brand/modal";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { createMcpToken, revokeMcpToken, type CreateTokenResult } from "@/lib/mcp/actions";

export type McpTokenRow = {
  id: string;
  label: string;
  campaign: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/** Settings → AI tools (MCP): create a campaign-scoped read-only token (shown once), list, revoke. */
export function McpTokens({
  tokens,
  campaigns,
  endpoint,
  previewToken,
}: {
  tokens: McpTokenRow[];
  campaigns: { id: string; name: string }[];
  endpoint: string;
  /** Kitchen sink only: render the "shown once" state without a database. */
  previewToken?: string;
}) {
  const [state, action, creating] = useActionState<CreateTokenResult | null, FormData>(
    createMcpToken,
    null,
  );
  const [dismissed, setDismissed] = useState<string | null>(null);
  const uid = useId();
  const ids = { label: `${uid}-label`, campaign: `${uid}-campaign`, error: `${uid}-error` };
  const created = state?.ok ? state.token : (previewToken ?? null);
  const fresh = created && created !== dismissed ? created : null;
  const config = fresh
    ? JSON.stringify(
        {
          mcpServers: {
            errata: {
              type: "http",
              url: endpoint,
              headers: { Authorization: `Bearer ${fresh}` },
            },
          },
        },
        null,
        2,
      )
    : "";

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied.`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <label htmlFor={ids.label} className="text-sm font-semibold">
            Name
          </label>
          <Input
            id={ids.label}
            name="label"
            required
            maxLength={80}
            placeholder="Cursor – Diwali copy"
            aria-invalid={state && !state.ok ? true : undefined}
            aria-describedby={state && !state.ok ? ids.error : undefined}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.campaign} className="text-sm font-semibold">
            Campaign
          </label>
          <select id={ids.campaign} name="campaignId" required className={fieldClass}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={creating || campaigns.length === 0}>
            {creating ? "Creating…" : "Create token"}
          </Button>
        </div>
        {state && !state.ok ? (
          <p id={ids.error} role="alert" className="text-danger text-sm sm:col-span-3">
            {state.error}
          </p>
        ) : null}
      </form>

      {fresh ? (
        <div
          role="status"
          className="border-outline bg-band-grey space-y-3 rounded-lg border-2 p-4"
        >
          <p className="text-sm font-semibold">
            Copy this token now. It is shown once and stored only as a hash.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={fresh}
              aria-label="New MCP token"
              className="font-mono text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="secondary" type="button" onClick={() => copy(fresh, "Token")}>
              Copy
            </Button>
          </div>
          <p className="text-fg-muted text-sm">
            Paste into your AI tool&apos;s MCP config (Cursor: <code>.cursor/mcp.json</code>; Claude
            Code: <code>.mcp.json</code>):
          </p>
          <pre
            tabIndex={0}
            aria-label="MCP config"
            className="bg-elevated border-line overflow-x-auto rounded-sm border p-3 font-mono text-xs"
          >
            {config}
          </pre>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => copy(config, "Config")}>
              Copy config
            </Button>
            <Button variant="ghost" type="button" onClick={() => setDismissed(fresh)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.length === 0 ? (
        <p className="text-fg-muted text-sm">No tokens yet.</p>
      ) : (
        <ul className="divide-line border-outline divide-y rounded-lg border-2 text-sm">
          {tokens.map((t) => (
            <TokenItem key={t.id} token={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TokenItem({ token: t }: { token: McpTokenRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const revoked = t.revokedAt !== null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">{t.label}</p>
        <p className="text-fg-muted text-xs">
          {t.campaign} · created {day(t.createdAt)} ·{" "}
          {t.lastUsedAt ? `last used ${day(t.lastUsedAt)}` : "never used"}
        </p>
      </div>
      {revoked ? (
        <span className="mono-label border-line-strong text-fg-muted rounded-sm border px-1.5 py-0.5">
          Revoked {day(t.revokedAt as string)}
        </span>
      ) : (
        <>
          <span className="sr-only">Active.</span>
          <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
            Revoke<span className="sr-only"> {t.label}</span>
          </Button>
          <Modal
            open={open}
            onOpenChange={setOpen}
            title={`Revoke “${t.label}”?`}
            description="Any AI tool using this token stops getting brand context immediately. This can't be undone; create a new token instead."
            confirm={
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await revokeMcpToken(t.id);
                    if (r.ok) {
                      toast.success("Token revoked.");
                      setOpen(false);
                    } else toast.error(r.error);
                  })
                }
              >
                {pending ? "Revoking…" : "Revoke token"}
              </Button>
            }
          />
        </>
      )}
    </li>
  );
}
