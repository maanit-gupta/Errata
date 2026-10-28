"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Drawer } from "@/components/brand/drawer";
import { IdCode } from "@/components/brand/id-badge";
import { SeverityBadge, type Severity } from "@/components/brand/severity-badge";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveRuleCards,
  archiveRuleCard,
  saveRuleCard,
  setRuleNeverSend,
} from "@/lib/vault/actions";
import { cn } from "@/lib/utils";
import { RuleStatusChip } from "./rule-card-list";
import { toastResult } from "./use-action-toast";

export type RuleDetail = {
  id: string;
  code: string;
  version: number;
  status: "draft" | "approved" | "archived";
  dimension: "tone" | "terms" | "facts" | "claims" | "visual" | "access";
  severity: Severity;
  title: string;
  summary: string;
  body: string;
  examples: { kind: "do" | "dont"; text: string; source?: "guide" | "generated" }[];
  source_page: number | null;
  never_send: boolean;
  sourceUrl: string | null;
};

const SEVERITIES: Severity[] = ["blocker", "warning", "suggestion"];

/** Rule card detail drawer (DESIGN.md §6.6), edited as a settings-style form. */
export function RuleCardPanel({ rule, closeHref }: { rule: RuleDetail; closeHref: string }) {
  const router = useRouter();
  const id = useId();
  const [draft, setDraft] = useState(rule);
  const [pending, start] = useTransition();
  const readOnly = rule.status === "archived";

  const set = <K extends keyof RuleDetail>(key: K, value: RuleDetail[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setExample = (i: number, patch: Partial<RuleDetail["examples"][number]>) =>
    set(
      "examples",
      draft.examples.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    );

  const save = () =>
    start(async () => {
      const result = await saveRuleCard({
        id: rule.id,
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        severity: draft.severity,
        dimension: draft.dimension,
        examples: draft.examples.filter((e) => e.text.trim()),
      });
      toastResult(result);
      if (result.ok && result.id && result.id !== rule.id)
        router.replace(`${closeHref}&card=${result.id}`, { scroll: false });
    });

  const footer = readOnly ? null : (
    <>
      {rule.status === "draft" ? (
        <Button
          disabled={pending}
          onClick={() => start(async () => toastResult(await approveRuleCards([rule.id])))}
        >
          Approve
        </Button>
      ) : null}
      <Button
        variant={rule.status === "draft" ? "secondary" : "primary"}
        disabled={pending}
        onClick={save}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button
        variant="danger"
        className="ml-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await archiveRuleCard(rule.id);
            toastResult(r);
            if (r.ok) router.replace(closeHref, { scroll: false });
          })
        }
      >
        Archive
      </Button>
    </>
  );

  return (
    <Drawer
      open
      closeHref={closeHref}
      eyebrow={
        <>
          <IdCode code={rule.code} />
          <RuleStatusChip status={rule.status} />
          <span className="mono-id text-fg-faint">v{rule.version}</span>
        </>
      }
      title={readOnly ? "Rule card (archived)" : "Edit rule card"}
      footer={footer}
    >
      {rule.status === "approved" ? (
        <p className="border-warning bg-warning-bg mb-4 rounded-lg border-2 p-3 text-sm">
          Saving creates v{rule.version + 1} and re-embeds this rule. Findings keep citing the
          version they were checked against.
        </p>
      ) : null}

      <fieldset disabled={readOnly || pending} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-code`}>Code</Label>
            <Input id={`${id}-code`} value={rule.code} readOnly className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-dim`}>Dimension</Label>
            <select
              id={`${id}-dim`}
              className={fieldClass}
              value={draft.dimension}
              onChange={(e) => set("dimension", e.target.value as RuleDetail["dimension"])}
            >
              {["tone", "terms", "claims", "facts", "visual", "access"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium">Severity</legend>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center rounded-lg border-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)",
                  draft.severity === s
                    ? "border-accent bg-accent-deep"
                    : "border-line-strong hover:bg-hover",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-sev`}
                  value={s}
                  checked={draft.severity === s}
                  onChange={() => set("severity", s)}
                  className="sr-only"
                />
                <SeverityBadge severity={s} />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input
            id={`${id}-title`}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-summary`}>Summary</Label>
          <p id={`${id}-summary-help`} className="text-fg-faint text-xs">
            Shown to agencies, who never see the full body.
          </p>
          <textarea
            id={`${id}-summary`}
            aria-describedby={`${id}-summary-help`}
            rows={2}
            className={fieldClass}
            value={draft.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-body`}>Body</Label>
          <textarea
            id={`${id}-body`}
            rows={6}
            className={fieldClass}
            value={draft.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Do / don&apos;t examples</legend>
          {draft.examples.map((ex, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`${id}-ex-kind-${i}`}>
                Example {i + 1} kind
              </label>
              <select
                id={`${id}-ex-kind-${i}`}
                className={cn(fieldClass, "w-24 shrink-0")}
                value={ex.kind}
                onChange={(e) => setExample(i, { kind: e.target.value as "do" | "dont" })}
              >
                <option value="do">Do</option>
                <option value="dont">Don&apos;t</option>
              </select>
              <label className="sr-only" htmlFor={`${id}-ex-text-${i}`}>
                Example {i + 1} text
              </label>
              <Input
                id={`${id}-ex-text-${i}`}
                value={ex.text}
                onChange={(e) => setExample(i, { text: e.target.value })}
              />
              <span
                className={cn(
                  "mono-label shrink-0 rounded-sm border px-1.5 py-0.5",
                  ex.source === "generated"
                    ? "border-accent-soft text-accent-soft"
                    : "border-line-strong text-fg-faint",
                )}
              >
                {ex.source === "generated" ? "GENERATED" : "GUIDE"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  set(
                    "examples",
                    draft.examples.filter((_, j) => j !== i),
                  )
                }
              >
                Remove <span className="sr-only">example {i + 1}</span>
              </Button>
            </div>
          ))}
          {draft.examples.length < 6 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => set("examples", [...draft.examples, { kind: "do", text: "" }])}
            >
              Add example
            </Button>
          ) : null}
        </fieldset>

        <p className="text-fg-muted text-sm">
          Source:{" "}
          {rule.source_page ? (
            rule.sourceUrl ? (
              <a
                href={`${rule.sourceUrl}#page=${rule.source_page}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent-soft font-semibold underline underline-offset-4"
              >
                guide p.{rule.source_page}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              `guide p.${rule.source_page}`
            )
          ) : (
            "added by hand"
          )}
        </p>
      </fieldset>

      <div className="border-line mt-5 flex items-start gap-3 border-t pt-4">
        <Lock aria-hidden className="text-fg-muted mt-0.5 size-4 shrink-0" />
        <div className="flex-1 space-y-0.5">
          <label htmlFor={`${id}-never`} className="text-sm font-medium">
            Never send to AI
          </label>
          <p id={`${id}-never-help`} className="text-fg-faint text-xs">
            Checked locally only. The rule is never included in what the LLM receives.
          </p>
        </div>
        <input
          id={`${id}-never`}
          type="checkbox"
          role="switch"
          aria-describedby={`${id}-never-help`}
          checked={draft.never_send}
          disabled={readOnly || pending}
          onChange={(e) => {
            const v = e.target.checked;
            set("never_send", v);
            start(async () => toastResult(await setRuleNeverSend(rule.id, v)));
          }}
          className="mt-1 size-5 accent-(--accent)"
        />
      </div>
    </Drawer>
  );
}
