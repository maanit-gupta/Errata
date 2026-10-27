"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form
      action={action}
      className="border-border grid items-end gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_12rem_14rem_auto]"
    >
      <div className="space-y-1">
        <label htmlFor={`${id}-t`} className="text-sm font-medium">
          Title
        </label>
        <Input id={`${id}-t`} name="title" required placeholder="Diwali SIP launch caption" />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-ch`} className="text-sm font-medium">
          Channel
        </label>
        <select
          id={`${id}-ch`}
          name="channel"
          className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
        >
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-cp`} className="text-sm font-medium">
          Campaign
        </label>
        <select
          id={`${id}-cp`}
          name="campaign_id"
          className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
        >
          {active.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        New draft
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-accent-text text-sm sm:col-span-4">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
