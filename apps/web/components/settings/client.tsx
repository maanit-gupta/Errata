"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendDiscordTest } from "@/lib/notify/actions";
import { SHORTCUTS_KEY, SKIP_LANDING_COOKIE, setPrefCookie } from "@/lib/ui-prefs";

export function DiscordTestButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await sendDiscordTest();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      {pending ? "Sending…" : "Send test message"}
    </Button>
  );
}

/** Undo for the landing page's "Always open app" (DESIGN.md §8). */
export function LandingToggle({ skipping }: { skipping: boolean }) {
  const [skip, setSkip] = useState(skipping);
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        role="switch"
        checked={!skip}
        onChange={(e) => {
          setSkip(!e.target.checked);
          setPrefCookie(SKIP_LANDING_COOKIE, e.target.checked ? "0" : "1");
        }}
        className="size-5 accent-(--accent)"
      />
      Show the landing page when I open BrandLens
    </label>
  );
}

export function ShortcutsToggle() {
  const [on, setOn] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem(SHORTCUTS_KEY) !== "off";
    } catch {
      return true;
    }
  });
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        suppressHydrationWarning
        onChange={(e) => {
          setOn(e.target.checked);
          try {
            localStorage.setItem(SHORTCUTS_KEY, e.target.checked ? "on" : "off");
          } catch {
            /* storage unavailable */
          }
        }}
        className="size-5 accent-(--accent)"
      />
      Single-key keyboard shortcuts (j, k, a, e, x, g …)
    </label>
  );
}
