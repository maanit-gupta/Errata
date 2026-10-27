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
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="bg-elevated border-line-strong shadow-pop fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-md border p-5 outline-none">
          <Dialog.Title className="text-lg">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="text-fg-muted text-sm">{description}</Dialog.Description>
          ) : null}
          {children}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
            {confirm}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
