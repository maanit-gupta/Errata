"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Right-side drawer (DESIGN.md §6.6): 560px, `--bg-elevated`, traps focus, Esc closes, and focus
 * returns to the trigger. Pass `closeHref` for URL-driven drawers (`?card=`), or `onClose`.
 */
export function Drawer({
  open,
  title,
  eyebrow,
  closeHref,
  onClose,
  children,
  footer,
  width = "w-[min(560px,100vw)]",
}: {
  open: boolean;
  title: ReactNode;
  eyebrow?: ReactNode;
  closeHref?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const router = useRouter();
  const close = () => {
    if (onClose) onClose();
    else if (closeHref) router.push(closeHref, { scroll: false });
  };
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? null : close())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-overlay fixed inset-0 z-40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "bg-elevated border-line-strong shadow-pop fixed inset-y-0 right-0 z-50 flex max-w-full flex-col border-l outline-none",
            "transition-transform duration-200 data-ending-style:translate-x-8 data-starting-style:translate-x-8",
            width,
          )}
        >
          <header className="border-line flex items-start gap-3 border-b px-5 py-4">
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
              <Dialog.Title className="text-xl">{title}</Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="text-fg-muted hover:bg-hover hover:text-fg inline-flex size-8 shrink-0 items-center justify-center rounded-md"
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <footer className="border-line flex flex-wrap gap-2 border-t px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
