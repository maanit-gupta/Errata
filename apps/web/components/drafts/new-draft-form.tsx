"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { createDraft, type Result } from "@/lib/drafts/actions";
import { CHANNELS } from "@/lib/drafts/intent";

export function NewDraftForm({
  campaigns,
}: {
  campaigns: { id: string; name: string; status: string }[];
}) {
  const [state, action, pending] = useActionState<Result | null, FormData>(createDraft, null);
  const id = useId();
  const active = campaigns.filter((c) => c.status !== "ended");
  return (
    <form action={action} className="border-line bg-elevated space-y-5 rounded-md border p-6">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-t`} className="text-sm font-medium">
          Title
        </label>
        <Input id={`${id}-t`} name="title" required placeholder="Diwali SIP launch caption" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-ch`} className="text-sm font-medium">
            Channel
          </label>
          <select id={`${id}-ch`} name="channel" className={fieldClass}>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-cp`} className="text-sm font-medium">
            Campaign
          </label>
          <select
            id={`${id}-cp`}
            name="campaign_id"
            className={fieldClass}
            aria-describedby={`${id}-cp-help`}
          >
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.status.toUpperCase()}
              </option>
            ))}
          </select>
          <p id={`${id}-cp-help`} className="text-fg-faint text-xs">
            Facts are checked against this campaign. Ended campaigns aren&apos;t listed.
          </p>
        </div>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="border-line flex justify-end border-t pt-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
