"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Re-render the server page when any of `tables` changes for this org (Realtime + RLS).
 * `pollMs` adds a slow fallback refresh while something is known to be in progress.
 */
export function RealtimeRefresh({
  orgId,
  tables,
  pollMs,
}: {
  orgId: string;
  tables: string[];
  pollMs?: number;
}) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase.channel(`vault:${orgId}:${key}`);
    for (const table of key.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` },
        refresh,
      );
    }

    // Realtime applies RLS, so the socket must carry the user's JWT before joining; the SSR client
    // loads the session from cookies asynchronously.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          console.warn(`[realtime] ${key}: ${status}`);
      });
    })();

    const poll = pollMs ? setInterval(() => router.refresh(), pollMs) : undefined;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [orgId, key, pollMs, router]);

  return null;
}
