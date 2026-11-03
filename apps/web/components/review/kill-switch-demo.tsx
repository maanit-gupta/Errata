"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toastResult } from "@/components/vault/use-action-toast";
import { restoreE19, simulateE19Change } from "@/lib/review/demo-actions";

/** Hero 2 demo controls (DEMO_MODE only): fire the real fact kill-switch on E-19, then undo it. */
export function KillSwitchDemo({ canSimulate }: { canSimulate: boolean }) {
  const [pending, start] = useTransition();
  const run = (action: typeof simulateE19Change) => () =>
    start(async () => toastResult(await action()));
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="mono-label text-fg-faint">Demo</span>
      {canSimulate ? (
        <Button variant="danger" size="sm" disabled={pending} onClick={run(simulateE19Change)}>
          Simulate Vault Edit on E-19 (Trigger Kill-Switch)
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" disabled={pending} onClick={run(restoreE19)}>
        Restore Original Fact E-19
      </Button>
    </span>
  );
}
