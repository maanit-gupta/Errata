"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadGuide, type ActionResult } from "@/lib/vault/actions";
import { useActionToast } from "./use-action-toast";

export function GuideUpload() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(uploadGuide, null);
  useActionToast(state);
  const id = useId();
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <label htmlFor={`${id}-file`} className="text-sm font-medium">
          Upload a PDF or DOCX
        </label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          accept=".pdf,.docx"
          className="block text-sm"
        />
      </div>
      <p className="text-muted-foreground text-sm sm:pb-1.5">or</p>
      <div className="space-y-1">
        <label htmlFor={`${id}-url`} className="text-sm font-medium">
          Paste a web page URL
        </label>
        <Input id={`${id}-url`} name="url" type="url" placeholder="https://" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Add guide"}
      </Button>
      <p aria-live="polite" className="text-sm sm:col-span-4">
        {state && !state.ok ? <span className="text-accent-text">{state.error}</span> : null}
      </p>
    </form>
  );
}
