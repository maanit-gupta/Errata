"use client";

import { useActionState, useId, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCampaign, saveCampaign, type ActionResult } from "@/lib/vault/actions";
import { toastResult, useActionToast } from "./use-action-toast";

export type CampaignRow = {
  id?: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: "planned" | "active" | "ended";
};

export function CampaignForm({ campaign }: { campaign?: CampaignRow }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCampaign,
    null,
  );
  const [deleting, start] = useTransition();
  useActionToast(state);
  const id = useId();
  const label = campaign ? campaign.name : "New campaign";

  return (
    <form
      action={action}
      aria-label={campaign ? `Edit ${label}` : "Create a campaign"}
      className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_10rem_9rem_auto]"
    >
      {campaign?.id ? <input type="hidden" name="id" value={campaign.id} /> : null}
      <div className="space-y-1">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Name
        </label>
        <Input id={`${id}-name`} name="name" defaultValue={campaign?.name} required />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-start`} className="text-sm font-medium">
          Starts
        </label>
        <Input
          id={`${id}-start`}
          name="starts_on"
          type="date"
          defaultValue={campaign?.starts_on ?? ""}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-end`} className="text-sm font-medium">
          Ends
        </label>
        <Input id={`${id}-end`} name="ends_on" type="date" defaultValue={campaign?.ends_on ?? ""} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-status`} className="text-sm font-medium">
          Status
        </label>
        <select
          id={`${id}-status`}
          name="status"
          defaultValue={campaign?.status ?? "planned"}
          className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
        >
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {campaign ? "Save" : "Create"}
          <span className="sr-only">&nbsp;{label}</span>
        </Button>
        {campaign?.id ? (
          <Button
            type="button"
            variant="ghost"
            disabled={deleting}
            onClick={() => start(async () => toastResult(await deleteCampaign(campaign.id!)))}
          >
            Delete <span className="sr-only">{label}</span>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
