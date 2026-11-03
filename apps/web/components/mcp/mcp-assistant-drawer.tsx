"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/brand/drawer";
import { SegmentedTabs } from "@/components/brand/segmented-tabs";
import { McpIntegrationModal } from "@/components/settings/mcp-integration";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { mcpConfigs } from "@/lib/mcp/config";
import { groundedSeedKey, PRESETS, type GroundedResult } from "@/lib/mcp/grounded";
import { createGroundedDraft, groundedChat } from "@/lib/mcp/grounded-actions";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied.`);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
  }
}

/**
 * "[MCP // PROMPT FIREWALL]" (R3 Hero E1): try grounded drafting in the browser, then connect
 * Claude or Cursor to the same read-only, RLS-scoped context.
 */
export function McpAssistantDrawer({
  endpoint,
  canSubmit,
}: {
  endpoint: string;
  canSubmit: boolean;
}) {
  // `?mcp=open` (the demo strip's quick-jump) opens the drawer on arrival.
  const [open, setOpen] = useState(useSearchParams().get("mcp") === "open");
  const [tab, setTab] = useState("chat");
  return (
    <>
      <Button variant="outline" type="button" onClick={() => setOpen(true)} className="font-mono">
        [MCP // PROMPT FIREWALL]
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={<span className="mono-label text-fg-muted">Read-only · no LLM · cited</span>}
        title="MCP prompt firewall"
      >
        <SegmentedTabs
          label="MCP drawer"
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: "chat", label: "Grounded chat" },
            { value: "connect", label: "Connect Claude / Cursor" },
          ]}
        >
          {tab === "chat" ? (
            <GroundedChat canSubmit={canSubmit} />
          ) : (
            <Connect endpoint={endpoint} active={open} />
          )}
        </SegmentedTabs>
      </Drawer>
    </>
  );
}

function GroundedChat({ canSubmit }: { canSubmit: boolean }) {
  const router = useRouter();
  const uid = useId();
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState<{
    result: GroundedResult;
    campaign: { id: string; name: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, run] = useTransition();
  const [sending, send] = useTransition();

  const ask = (p: string) =>
    run(async () => {
      setError(null);
      const r = await groundedChat({ prompt: p });
      if (r.ok) setOut({ result: r.result, campaign: r.campaign });
      else {
        setOut(null);
        setError(r.error);
      }
    });

  const toEditor = () =>
    out &&
    send(async () => {
      const { result, campaign } = out;
      const r = await createGroundedDraft({
        title: result.title,
        channel: result.intent.channel,
        campaign_id: campaign.id,
      });
      if (!r.ok) return void toast.error(r.error);
      try {
        sessionStorage.setItem(
          groundedSeedKey(r.id),
          JSON.stringify({
            body: result.text,
            intent: { ...result.intent, campaign_id: campaign.id },
          }),
        );
      } catch {
        // storage blocked: the draft opens empty and the text can be pasted
      }
      router.push(`/drafts/${r.id}`);
    });

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Drafts are written only from this campaign&apos;s approved, unexpired facts and rule cards,
        loaded with the same filters as the MCP{" "}
        <code className="mono-id">get_campaign_context</code> tool. Never-send items are filtered
        out before anything is written.
      </p>
      <div className="grid gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={running}
            onClick={() => {
              setPrompt(p.prompt);
              ask(p.prompt);
            }}
            className="border-outline hover:bg-hover rounded-sm border-2 px-3 py-2 text-left text-sm disabled:opacity-50"
          >
            <span className="font-semibold">{p.label}</span>
            <span className="text-fg-muted block font-mono text-xs">{p.hint}</span>
          </button>
        ))}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(prompt);
        }}
      >
        <label htmlFor={`${uid}-p`} className="text-sm font-semibold">
          Or type a prompt
        </label>
        <textarea
          id={`${uid}-p`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          maxLength={500}
          className={`${fieldClass} h-auto py-2`}
          placeholder="Draft a push notification about the Flexi-Cap fund's exit load"
        />
        <Button type="submit" disabled={running || prompt.trim().length < 3}>
          {running ? "Grounding…" : "Draft grounded copy"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      {out ? (
        <section aria-live="polite" className="space-y-3">
          <p className="border-outline bg-code rounded-sm border px-2 py-1 font-mono text-xs">
            ✓ grounded ({out.campaign.name}):{" "}
            {out.result.factIds.length ? out.result.factIds.join(", ") : "no facts"} injected
            {out.result.ruleIds.length ? ` · rules ${out.result.ruleIds.join(", ")}` : ""} ·{" "}
            {out.result.leaked}/{out.result.canaries} never-send items leaked
          </p>
          <div className="border-outline rounded-sm border-2 p-3 text-sm whitespace-pre-wrap">
            {out.result.text}
          </div>
          <dl className="text-fg-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="font-semibold">Goal</dt>
            <dd>{out.result.intent.goal}</dd>
            <dt className="font-semibold">Audience</dt>
            <dd>{out.result.intent.audience}</dd>
            <dt className="font-semibold">CTA</dt>
            <dd>{out.result.intent.cta}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            {canSubmit && out.result.factIds.length ? (
              <Button type="button" onClick={toEditor} disabled={sending}>
                {sending ? "Creating draft…" : "Send grounded draft to editor →"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              type="button"
              onClick={() => copy(out.result.text, "Draft")}
            >
              Copy text
            </Button>
          </div>
          <p className="text-fg-faint text-xs">
            The draft still goes through the full check: grounding narrows mistakes, it doesn&apos;t
            approve anything.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Connect({ endpoint, active }: { endpoint: string; active: boolean }) {
  const [status, setStatus] = useState<"checking" | "ok" | "down" | "unknown">("checking");
  const [keyOpen, setKeyOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch("/api/worker-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { status?: string }) => {
        if (live) setStatus(j.status === "ok" ? "ok" : j.status === "down" ? "down" : "unknown");
      })
      .catch(() => live && setStatus("down"));
    return () => {
      live = false;
    };
  }, [active]);
  const label =
    status === "ok"
      ? "ONLINE"
      : status === "down"
        ? "OFFLINE"
        : status === "unknown"
          ? "NOT CONFIGURED"
          : "CHECKING…";
  const desktop = mcpConfigs(endpoint, "<paste your bl_mcp_ key>").claudeDesktop;
  return (
    <div className="space-y-4">
      <p
        role="status"
        className="border-outline inline-block rounded-sm border px-2 py-0.5 font-mono text-xs"
      >
        {status === "ok" ? "●" : "○"} {label} · READ-ONLY · RLS-SCOPED
      </p>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Endpoint</p>
        <p className="mono-id bg-code border-line rounded-sm border px-2 py-1 text-xs break-all">
          {endpoint}
        </p>
      </div>
      <p className="text-fg-muted text-sm">
        A personal key acts with your current role and can only read: campaign facts, glossary,
        approved rules and the fast pre-check. It is shown once and stored as a hash.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setKeyOpen(true)}>
          Generate scoped key
        </Button>
        <Button variant="secondary" type="button" onClick={() => copy(desktop, "Config")}>
          Copy claude_desktop_config.json
        </Button>
      </div>
      <pre
        tabIndex={0}
        aria-label="claude_desktop_config.json template"
        className="bg-code border-line max-h-60 overflow-auto rounded-sm border p-3 font-mono text-xs"
      >
        {desktop}
      </pre>
      <McpIntegrationModal open={keyOpen} onOpenChange={setKeyOpen} endpoint={endpoint} />
    </div>
  );
}
