"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { CHANNELS } from "@/lib/drafts/intent";
import { buildGroundedDraft, type GroundedResult } from "@/lib/mcp/grounded";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export type ChatResult =
  | { ok: true; result: GroundedResult; campaign: { id: string; name: string } }
  | { ok: false; error: string };

const ChatInput = z.object({ prompt: z.string().trim().min(3, "Type a prompt.").max(500) });

/**
 * Grounded chat as the signed-in user (RLS-scoped). Context mirrors the worker's MCP
 * `get_campaign_context`: the campaign's own facts plus org-wide ones, unexpired, never
 * never_send; approved rules only. Agencies get facts only (rule cards are staff-only in the app).
 */
export async function groundedChat(input: { prompt: string }): Promise<ChatResult> {
  const session = await requireSession();
  const parsed = ChatInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { prompt } = parsed.data;
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("org_id", session.orgId)
    .eq("status", "active")
    .order("starts_on", { ascending: false });
  if (!campaigns?.length) return { ok: false, error: "No active campaign to ground against." };
  const p = prompt.toLowerCase();
  const campaign =
    campaigns.find((c) =>
      c.name
        .toLowerCase()
        .split(/\s+/)
        .some((t) => t.length > 3 && !/^\d+$/.test(t) && p.includes(t)),
    ) ?? campaigns[0];

  const now = Date.now();
  const staff = session.role !== "agency_creator";
  const [facts, rules, hiddenFacts, hiddenRules] = await Promise.all([
    supabase
      .from("facts")
      .select("code, kind, statement, value, required_disclaimer, valid_until")
      .eq("org_id", session.orgId)
      .eq("never_send", false)
      .or(`campaign_id.is.null,campaign_id.eq.${campaign.id}`)
      .order("code"),
    staff
      ? supabase
          .from("rule_cards")
          .select("code, title, summary")
          .eq("org_id", session.orgId)
          .eq("status", "approved")
          .eq("never_send", false)
          .order("code")
      : Promise.resolve({ data: [] }),
    supabase
      .from("facts")
      .select("code, statement")
      .eq("org_id", session.orgId)
      .eq("never_send", true),
    staff
      ? supabase
          .from("rule_cards")
          .select("code, title")
          .eq("org_id", session.orgId)
          .eq("never_send", true)
      : Promise.resolve({ data: [] }),
  ]);
  if (facts.error) return { ok: false, error: "Couldn't load campaign facts." };

  const result = buildGroundedDraft({
    prompt,
    campaignName: campaign.name,
    facts: (facts.data ?? []).filter((f) => !f.valid_until || Date.parse(f.valid_until) > now),
    rules: rules.data ?? [],
    canaries: [
      ...(hiddenFacts.data ?? []).map((f) => ({ code: f.code, text: f.statement })),
      ...(hiddenRules.data ?? []).map((r) => ({ code: r.code, text: r.title })),
    ],
  });
  return { ok: true, result, campaign };
}

const SendInput = z.object({
  title: z.string().trim().min(1).max(140),
  channel: z.enum(CHANNELS.map((c) => c.value) as [string, ...string[]]),
  campaign_id: z.uuid(),
});

/** "Send to editor": create the draft; the client hands its text and intent to the workspace. */
export async function createGroundedDraft(
  input: z.input<typeof SendInput>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!can(session.role, "submit_content"))
    return { ok: false, error: "Your role can't create drafts." };
  const parsed = SendInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't create the draft." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contents")
    .insert({ ...parsed.data, org_id: session.orgId, owner_id: session.userId })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Couldn't create the draft." };
  return { ok: true, id: data.id };
}
