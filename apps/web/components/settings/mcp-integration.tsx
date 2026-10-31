"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/brand/modal";
import { SegmentedTabs } from "@/components/brand/segmented-tabs";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { createMcpKey, revokeMcpKey, type CreateKeyResult } from "@/lib/mcp/actions";
import { KEY_EXPIRY_DAYS, mcpConfigs } from "@/lib/mcp/config";

export type McpKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  owner: string | null; // shown to brand admins for other people's keys
  mine: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  /** Computed on the server at render time. */
  expired: boolean;
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied.`);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
  }
}

/**
 * Settings → AI tools (MCP): connect Cursor / Claude to this org's brand context with a personal,
 * read-only key (shown once), then list and revoke keys. Brand admins see and can revoke every key.
 */
export function McpIntegration({
  keys,
  endpoint,
  canRevokeOthers,
  previewKey,
}: {
  keys: McpKeyRow[];
  endpoint: string;
  canRevokeOthers: boolean;
  /** Kitchen sink only: open the modal in its "shown once" state without a database. */
  previewKey?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => setOpen(true)}>
          Connect Claude or Cursor
        </Button>
        <p className="text-fg-muted text-sm">
          Read-only. Uses your role: agency keys get rule summaries only.
        </p>
      </div>
      <McpIntegrationModal
        open={open || previewKey !== undefined}
        onOpenChange={setOpen}
        endpoint={endpoint}
        previewKey={previewKey}
      />
      {keys.length === 0 ? (
        <p className="text-fg-muted text-sm">No keys yet.</p>
      ) : (
        <ul className="divide-line border-outline divide-y rounded-lg border-2 text-sm">
          {keys.map((k) => (
            <KeyItem key={k.id} k={k} canRevoke={k.mine || canRevokeOthers} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Generate a key and copy a ready-made config (build spec §6.1, in DESIGN.md's system). */
export function McpIntegrationModal({
  open,
  onOpenChange,
  endpoint,
  previewKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  previewKey?: string;
}) {
  const [state, action, creating] = useActionState<CreateKeyResult | null, FormData>(
    createMcpKey,
    null,
  );
  const [seen, setSeen] = useState<string | null>(null);
  const [client, setClient] = useState("cursor");
  const uid = useId();
  const created = state?.ok ? state.key.rawKey : (previewKey ?? null);
  const fresh = created && created !== seen ? created : null;
  const configs = fresh ? mcpConfigs(endpoint, fresh) : null;
  const shown =
    configs &&
    (client === "code"
      ? configs.claudeCode
      : client === "desktop"
        ? configs.claudeDesktop
        : configs.cursor);
  const where =
    client === "code"
      ? "Run in your project's terminal (Claude Code):"
      : client === "desktop"
        ? "Add to claude_desktop_config.json (needs Node; uses the mcp-remote bridge):"
        : "Add to .cursor/mcp.json in your project (or ~/.cursor/mcp.json):";

  const close = (next: boolean) => {
    if (!next && fresh) setSeen(fresh);
    onOpenChange(next);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Connect Claude or Cursor"
      description="Your AI tool gets this organisation's live campaign facts, glossary and approved rules, plus Errata's fast pre-check. It can't change anything or publish."
      confirm={
        fresh ? (
          <Button type="button" onClick={() => close(false)}>
            Done
          </Button>
        ) : (
          <Button type="submit" form={`${uid}-form`} disabled={creating}>
            {creating ? "Generating…" : "Generate key"}
          </Button>
        )
      }
    >
      {fresh && configs ? (
        <div className="space-y-3">
          <p role="status" className="text-sm font-semibold">
            Copy this key now. It is shown once and stored only as a hash.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={fresh}
              aria-label="New MCP key"
              className="font-mono text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="secondary" type="button" onClick={() => copy(fresh, "Key")}>
              Copy
            </Button>
          </div>
          <SegmentedTabs
            label="AI tool"
            value={client}
            onValueChange={setClient}
            tabs={[
              { value: "cursor", label: "Cursor" },
              { value: "code", label: "Claude Code" },
              { value: "desktop", label: "Claude Desktop" },
            ]}
          >
            <div className="space-y-2">
              <p className="text-fg-muted text-sm">{where}</p>
              <pre
                tabIndex={0}
                aria-label="MCP config"
                className="bg-code border-line max-h-60 overflow-auto rounded-sm border p-3 font-mono text-xs"
              >
                {shown}
              </pre>
              <Button variant="secondary" type="button" onClick={() => copy(shown ?? "", "Config")}>
                Copy config
              </Button>
            </div>
          </SegmentedTabs>
        </div>
      ) : (
        <form id={`${uid}-form`} action={action} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={`${uid}-name`} className="text-sm font-semibold">
              Key name
            </label>
            <Input
              id={`${uid}-name`}
              name="name"
              required
              maxLength={80}
              defaultValue="Claude / Cursor"
              aria-invalid={state && !state.ok ? true : undefined}
              aria-describedby={state && !state.ok ? `${uid}-error` : undefined}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${uid}-exp`} className="text-sm font-semibold">
              Expires after
            </label>
            <select id={`${uid}-exp`} name="expiresInDays" defaultValue="90" className={fieldClass}>
              {KEY_EXPIRY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
          {state && !state.ok ? (
            <p id={`${uid}-error`} role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </Modal>
  );
}

function KeyItem({ k, canRevoke }: { k: McpKeyRow; canRevoke: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ended = k.revokedAt ? `Revoked ${day(k.revokedAt)}` : k.expired ? "Expired" : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {k.name} <span className="mono-id text-fg-muted font-normal">{k.keyPrefix}…</span>
        </p>
        <p className="text-fg-muted text-xs">
          {k.owner && !k.mine ? `${k.owner} · ` : ""}created {day(k.createdAt)} · expires{" "}
          {day(k.expiresAt)} · {k.lastUsedAt ? `last used ${day(k.lastUsedAt)}` : "never used"}
        </p>
      </div>
      {ended ? (
        <span className="mono-label border-line-strong text-fg-muted rounded-sm border px-1.5 py-0.5">
          {ended}
        </span>
      ) : canRevoke ? (
        <>
          <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
            Revoke<span className="sr-only"> {k.name}</span>
          </Button>
          <Modal
            open={open}
            onOpenChange={setOpen}
            title={`Revoke “${k.name}”?`}
            description="The AI tool using this key loses access immediately. This can't be undone; create a new key instead."
            confirm={
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await revokeMcpKey(k.id);
                    if (r.ok) {
                      toast.success("Key revoked.");
                      setOpen(false);
                    } else toast.error(r.error);
                  })
                }
              >
                {pending ? "Revoking…" : "Revoke key"}
              </Button>
            }
          />
        </>
      ) : null}
    </li>
  );
}
