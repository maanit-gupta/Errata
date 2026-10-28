import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv, serverEnv } from "@/lib/env";
import type { NotifyEvent } from "./discord";

/** Optional email via Resend (SPEC §15). No-op unless RESEND_API_KEY and EMAIL_FROM are set. */
export async function notifyEmail(e: NotifyEvent, ownerId: string): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  if (!RESEND_API_KEY || !EMAIL_FROM) return;
  if (e.type !== "changes_requested" && e.type !== "publish_ready") return;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(ownerId);
    const to = data.user?.email;
    if (!to) return;
    const link = `${clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/drafts/${e.contentId}`;
    const subject =
      e.type === "changes_requested"
        ? `Changes requested: ${e.title}`
        : `Publish-ready: ${e.title}`;
    const text =
      e.type === "changes_requested"
        ? `A reviewer requested changes on "${e.title}": ${e.reason}\n\n${link}`
        : `"${e.title}" is approved and publish-ready. Errata never publishes for you.\n\n${link}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[notify] email ${e.type} failed: HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[notify] email ${e.type} failed:`, err instanceof Error ? err.name : "error");
  }
}
