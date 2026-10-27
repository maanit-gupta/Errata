"use client";

import { ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SKIP_LANDING_COOKIE, setPrefCookie } from "@/lib/ui-prefs";

/** Signed-in visitors only (DESIGN.md §8): "Skip this page next time?" Undo lives in Settings. */
export function SkipToast() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <aside
      aria-label="Skip the landing page"
      className="bg-elevated border-line-strong shadow-pop fixed top-20 right-4 z-30 flex max-w-xs items-start gap-3 border p-3 text-sm"
    >
      <div className="space-y-2">
        <p>Skip this page next time?</p>
        <button
          type="button"
          onClick={() => {
            setPrefCookie(SKIP_LANDING_COOKIE, "1");
            router.push("/drafts");
          }}
          className="bg-fg text-canvas hover:bg-accent hover:text-accent-fg inline-flex h-8 items-center gap-1 px-3 text-sm font-medium"
        >
          Always open app <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
        className="text-fg-muted hover:text-fg inline-flex size-7 items-center justify-center"
      >
        <X aria-hidden className="size-4" />
      </button>
    </aside>
  );
}
