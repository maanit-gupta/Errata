"use client";

import { useSyncExternalStore } from "react";
import { expiryCountdown } from "@/lib/review/countdown";

const MINUTE = 60_000;
const subscribe = (tick: () => void) => {
  const timer = setInterval(tick, MINUTE);
  return () => clearInterval(timer);
};
// Stable within a minute, so React doesn't re-render on every read.
const nowToTheMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const noNowOnTheServer = () => null;

/**
 * Hero 2: live time left on a publish receipt, ticking every minute. Renders nothing on the server
 * and during hydration, so the server and client HTML never disagree about "now". Not a live
 * region: a screen reader would otherwise hear it every minute.
 */
export function ExpiryCountdown({ until }: { until: string }) {
  const now = useSyncExternalStore(subscribe, nowToTheMinute, noNowOnTheServer);
  if (now === null) return null;
  const c = expiryCountdown(until, now);
  if (!c) return null;
  return (
    <span className={c.soon ? "text-warning font-semibold" : "text-fg-muted"}>· {c.text}</span>
  );
}
