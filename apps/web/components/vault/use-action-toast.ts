"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/vault/actions";

/** Toast the outcome of a `useActionState` server action once per result. */
export function useActionToast(state: ActionResult | null, onOk?: () => void) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      onOk?.();
    } else toast.error(state.error);
    // Fire once per result, not when the callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function toastResult(result: ActionResult) {
  if (result.ok) toast.success(result.message ?? "Saved.");
  else toast.error(result.error);
}
