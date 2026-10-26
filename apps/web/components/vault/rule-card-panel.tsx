"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { IdCode } from "@/components/brand/id-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveRuleCards, archiveRuleCard, saveRuleCard } from "@/lib/vault/actions";
import { toastResult } from "./use-action-toast";

export type RuleDetail = {
  id: string;
  code: string;
  version: number;
  status: "draft" | "approved" | "archived";
  dimension: "tone" | "terms" | "facts" | "claims" | "visual" | "access";
  severity: "blocker" | "warning" | "suggestion";
  title: string;
  summary: string;
  body: string;
  examples: { kind: "do" | "dont"; text: string }[];
  source_page: number | null;
  sourceUrl: string | null;
};

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

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
        router.replace(`${closeHref}&card=${result.id}`);
    });

  return (
    <aside
      aria-labelledby={`${id}-heading`}
      className="border-border bg-card rounded-lg border p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <IdCode code={rule.code} />
            <span className="text-muted-foreground font-mono text-xs">
              v{rule.version} · {rule.status}
            </span>
          </div>
          <h2 id={`${id}-heading`} className="font-heading text-xl">
            {readOnly ? "Rule card (archived)" : "Edit rule card"}
          </h2>
        </div>
        <Link
          href={closeHref}
          scroll={false}
          className="text-sm font-medium underline underline-offset-4"
        >
          Close
        </Link>
      </div>

      {rule.status === "approved" ? (
        <p className="bg-muted mb-4 rounded-md p-3 text-sm">
          Saving an approved rule creates version {rule.version + 1}. Findings keep citing the
          version they were checked against.
        </p>
      ) : null}

      <fieldset disabled={readOnly || pending} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-dim`}>Dimension</Label>
            <select
              id={`${id}-dim`}
              className={field}
              value={draft.dimension}
              onChange={(e) => set("dimension", e.target.value as RuleDetail["dimension"])}
            >
              {["tone", "terms", "claims", "facts", "visual", "access"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-sev`}>Severity</Label>
            <select
              id={`${id}-sev`}
              className={field}
              value={draft.severity}
              onChange={(e) => set("severity", e.target.value as RuleDetail["severity"])}
            >
              {["blocker", "warning", "suggestion"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input
            id={`${id}-title`}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-summary`}>Summary (agencies see only this)</Label>
          <textarea
            id={`${id}-summary`}
            rows={2}
            className={field}
            value={draft.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-body`}>Body</Label>
          <textarea
            id={`${id}-body`}
            rows={6}
            className={field}
            value={draft.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Examples</legend>
          {draft.examples.map((ex, i) => (
            <div key={i} className="flex gap-2">
              <label className="sr-only" htmlFor={`${id}-ex-kind-${i}`}>
                Example {i + 1} kind
              </label>
              <select
                id={`${id}-ex-kind-${i}`}
                className="border-input bg-card rounded-md border px-2 text-sm"
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
              variant="outline"
              size="sm"
              onClick={() => set("examples", [...draft.examples, { kind: "do", text: "" }])}
            >
              Add example
            </Button>
          ) : null}
        </fieldset>

        <p className="text-muted-foreground text-sm">
          Source:{" "}
          {rule.source_page ? (
            rule.sourceUrl ? (
              <a
                href={`${rule.sourceUrl}#page=${rule.source_page}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                guide page {rule.source_page}
              </a>
            ) : (
              `guide page ${rule.source_page}`
            )
          ) : (
            "added by hand"
          )}
        </p>

        {!readOnly ? (
          <div className="border-border flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" onClick={save}>
              Save
            </Button>
            {rule.status === "draft" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => start(async () => toastResult(await approveRuleCards([rule.id])))}
              >
                Approve
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                start(async () => {
                  const r = await archiveRuleCard(rule.id);
                  toastResult(r);
                  if (r.ok) router.replace(closeHref);
                })
              }
            >
              Archive
            </Button>
          </div>
        ) : null}
      </fieldset>
    </aside>
  );
}
