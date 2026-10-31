"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Settings → AI tools (MCP). Brand admin only; the SQL functions check the role again. */

export type CreateTokenResult = { ok: true; token: string } | { ok: false; error: string };
export type RevokeResult = { ok: true } | { ok: false; error: string };

const CreateInput = z.object({
  label: z.string().trim().min(1, "Give the token a name.").max(80, "Use 80 characters or fewer."),
  campaignId: z.uuid("Choose a campaign."),
});

export async function createMcpToken(
  _prev: CreateTokenResult | null,
  formData: FormData,
): Promise<CreateTokenResult> {
  const session = await requireSession();
  if (session.role !== "brand_admin")
    return { ok: false, error: "Only brand admins can create MCP tokens." };
  const parsed = CreateInput.safeParse({
    label: formData.get("label"),
    campaignId: formData.get("campaignId"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_mcp_token", {
    p_org: session.orgId,
    p_campaign: parsed.data.campaignId,
    p_label: parsed.data.label,
  });
  if (error || !data) {
    const tooMany = error?.code === "54000";
    return {
      ok: false,
      error: tooMany ? "20 tokens are active. Revoke one first." : "Couldn't create the token.",
    };
  }
  revalidatePath("/settings");
  // Returned once to the browser that asked; never stored or logged in plaintext.
  return { ok: true, token: data };
}

export async function revokeMcpToken(id: string): Promise<RevokeResult> {
  const session = await requireSession();
  if (session.role !== "brand_admin")
    return { ok: false, error: "Only brand admins can revoke MCP tokens." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown token." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_mcp_token", { p_id: id });
  if (error) return { ok: false, error: "Couldn't revoke the token." };
  revalidatePath("/settings");
  return { ok: true };
}
