"use server";

import { requireSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";

/** Settings → Notifications → "Send test message" (admin only). Never echoes the webhook URL. */
export async function sendDiscordTest(): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  if (session.role !== "brand_admin")
    return { ok: false, message: "Only brand admins can send a test." };
  try {
    const res = await fetch(serverEnv().DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `Errata test message from ${session.orgName} settings.` }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok
      ? { ok: true, message: "Test message sent to Discord." }
      : { ok: false, message: `Discord answered HTTP ${res.status}.` };
  } catch {
    return { ok: false, message: "Couldn't reach Discord. Try again in a minute." };
  }
}
