"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Centred confirm dialog (DESIGN.md §5): traps focus, Esc and Cancel close it, and focus returns
 * to the trigger. The caller owns `open` so an action can close it once its server call succeeds.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirm: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-overlay fixed inset-0 z-40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="bg-elevated border-outline fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(32.5rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-lg border-2 p-6 outline-none">
          <Dialog.Title className="text-xl font-bold tracking-[-0.01em]">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="text-fg-muted text-sm">{description}</Dialog.Description>
          ) : null}
          {children}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
            {confirm}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
