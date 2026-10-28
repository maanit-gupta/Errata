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
      className="bg-elevated border-outline fixed top-24 right-4 z-30 flex max-w-xs items-start gap-3 rounded-[8px] border-2 p-4 text-[0.9375rem]"
    >
      <div className="space-y-2">
        <p className="font-semibold">Open the app by default?</p>
        <button
          type="button"
          onClick={() => {
            setPrefCookie(SKIP_LANDING_COOKIE, "1");
            router.push("/drafts");
          }}
          className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex h-9 items-center gap-1 rounded-sm px-3 text-sm font-semibold"
        >
          Always open app <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
        className="text-fg hover:bg-hover inline-flex size-8 items-center justify-center rounded-sm"
      >
        <X aria-hidden className="size-4" />
      </button>
    </aside>
  );
}
