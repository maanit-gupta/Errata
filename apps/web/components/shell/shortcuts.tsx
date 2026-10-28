"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SHORTCUTS_KEY, shortcutsEnabled } from "@/lib/ui-prefs";

const GO: Record<string, string> = { d: "/drafts", r: "/review", v: "/vault", i: "/insights" };

const KEYS: [string, string][] = [
  ["⌘K / Ctrl K", "Command palette"],
  ["?", "This sheet"],
  ["g d · g r · g v · g i", "Go to Drafts / Review / Vault / Insights"],
  ["j / k", "Next / previous finding"],
  ["a / e / x", "Accept / edit / dismiss the focused finding, when allowed"],
  ["Esc", "Close the drawer, dialog or palette"],
];

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Global keyboard shortcuts (DESIGN.md §7.4). Single-key shortcuts never fire in text inputs and
 * can be switched off here (WCAG 2.1.4). Finding keys are re-broadcast as `bl-finding-key`.
 */
export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const pendingG = useRef(0);

  useEffect(() => {
    const show = () => {
      setEnabled(shortcutsEnabled());
      setOpen(true);
    };
    window.addEventListener("bl-shortcuts", show);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event("bl-palette"));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || !shortcutsEnabled()) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "?") {
        e.preventDefault();
        show();
        return;
      }
      if (pendingG.current && Date.now() - pendingG.current < 1000 && GO[e.key]) {
        pendingG.current = 0;
        router.push(GO[e.key]);
        return;
      }
      pendingG.current = e.key === "g" ? Date.now() : 0;
      if (["j", "k", "a", "e", "x"].includes(e.key)) {
        window.dispatchEvent(new CustomEvent("bl-finding-key", { detail: e.key }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("bl-shortcuts", show);
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-overlay fixed inset-0 z-50" />
        <Dialog.Popup className="bg-elevated border-line-strong shadow-pop fixed top-1/2 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-md border p-5 outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="text-fg-muted hover:bg-hover inline-flex size-8 items-center justify-center rounded-md"
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </div>
          <dl className="divide-line divide-y text-sm">
            {KEYS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2">
                <dt className="mono-id text-accent-soft">{k}</dt>
                <dd className="text-fg-muted text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                try {
                  localStorage.setItem(SHORTCUTS_KEY, e.target.checked ? "on" : "off");
                } catch {
                  /* storage unavailable: preference lasts this page only */
                }
              }}
              className="size-4 accent-(--accent)"
            />
            Single-key shortcuts (j, k, a, e, x, g …)
          </label>
          <p className="text-fg-faint text-xs">Every shortcut has a clickable equivalent.</p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
