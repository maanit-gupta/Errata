import "server-only";
import { clientEnv, serverEnv } from "@/lib/env";

/**
 * Discord notifications (SPEC §15). Fire-and-forget: call from `after()`, never await in the request
 * path. Never include draft text: titles, IDs and links only.
 */

export type NotifyEvent =
  | { type: "needs_review"; contentId: string; title: string; routeTo: string; risk: number | null }
  | { type: "changes_requested"; contentId: string; title: string; reason: string }
  | { type: "publish_ready"; contentId: string; title: string }
  | { type: "approved"; contentId: string; title: string };

const VERMILION = 0xd63a24;
const GREEN = 0x2f6b3a;
const INK = 0x141414;

export function discordPayload(e: NotifyEvent, siteUrl: string) {
  const link = `${siteUrl.replace(/\/$/, "")}${e.type === "needs_review" ? "/review/" : "/review/"}${e.contentId}`;
  switch (e.type) {
    case "needs_review":
      return {
        embeds: [
          {
            title: `📝 ${e.title} needs review`,
            description: `Route: **${e.routeTo}** · risk ${e.risk ?? "–"}`,
            url: link,
            color: INK,
          },
        ],
      };
    case "changes_requested":
      return {
        embeds: [
          {
            title: `↩️ Changes requested on ${e.title}`,
            description: e.reason.slice(0, 300),
            url: link,
            color: VERMILION,
          },
        ],
      };
    case "approved":
    case "publish_ready":
      return {
        embeds: [
          {
            title: `✅ ${e.title} is ${e.type === "publish_ready" ? "publish-ready" : "approved"}`,
            description: `Audit trail: ${link}#audit`,
            url: `${link}#audit`,
            color: GREEN,
          },
        ],
      };
  }
}

export async function notifyDiscord(e: NotifyEvent): Promise<void> {
  try {
    const url = serverEnv().DISCORD_WEBHOOK_URL;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(discordPayload(e, clientEnv.NEXT_PUBLIC_SITE_URL)),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[notify] discord ${e.type} failed: HTTP ${res.status}`);
    else console.info(`[notify] discord ${e.type} sent (HTTP ${res.status})`);
  } catch (err) {
    console.warn(`[notify] discord ${e.type} failed:`, err instanceof Error ? err.name : "error");
  }
}
