"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ANNOUNCE_COOKIE, setPrefCookie } from "@/lib/ui-prefs";

/** Announcement bar (DESIGN.md §8.1): 36px, `--accent-deep`, dismissible (cookie). */
export function AnnouncementBar({ hidden }: { hidden: boolean }) {
  const [gone, setGone] = useState(hidden);
  if (gone) return null;
  return (
    <div className="bg-accent-deep text-fg relative flex min-h-9 items-center justify-center px-10 py-1.5 text-center text-[0.8125rem]">
      <p>
        Round 2 build · Inkloom AI brand-governance problem statement ·{" "}
        <Link
          href="/login"
          className="text-accent-soft font-medium underline-offset-4 hover:underline"
        >
          Try the live demo →
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          setGone(true);
          setPrefCookie(ANNOUNCE_COOKIE, "hidden");
        }}
        className="text-fg-muted hover:text-fg absolute right-2 inline-flex size-7 items-center justify-center"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
