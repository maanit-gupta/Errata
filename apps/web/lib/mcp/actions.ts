"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { KEY_EXPIRY_DAYS } from "@/lib/mcp/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings → AI tools (MCP). Any member creates keys for themselves; the key acts with their
 * current role. The SQL functions enforce membership, ownership and limits again. Server actions
 * (not a bare route handler) so Next's same-origin check guards these mutations.
 */

export type NewMcpKey = { rawKey: string; keyPrefix: string; expiresAt: string };
export type CreateKeyResult = { ok: true; key: NewMcpKey } | { ok: false; error: string };
export type RevokeResult = { ok: true } | { ok: false; error: string };

const CreateInput = z.object({
  name: z.string().trim().min(1, "Give the key a name.").max(80, "Use 80 characters or fewer."),
  expiresInDays: z.coerce
    .number()
    .refine((d) => (KEY_EXPIRY_DAYS as readonly number[]).includes(d), "Choose an expiry."),
});

export async function createMcpKey(
  _prev: CreateKeyResult | null,
  formData: FormData,
): Promise<CreateKeyResult> {
  const session = await requireSession();
  const parsed = CreateInput.safeParse({
    name: formData.get("name"),
    expiresInDays: formData.get("expiresInDays"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_mcp_key", {
    p_org: session.orgId,
    p_name: parsed.data.name,
    p_expires_in_days: parsed.data.expiresInDays,
  });
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      error:
        error?.code === "54000"
          ? "You already have 5 active keys. Revoke one first."
          : "Couldn't create the key.",
    };
  }
  revalidatePath("/settings");
  // Returned once to the browser that asked; only its hash is stored.
  return {
    ok: true,
    key: { rawKey: row.raw_key, keyPrefix: row.key_prefix, expiresAt: row.expires_at },
  };
}

export async function revokeMcpKey(id: string): Promise<RevokeResult> {
  await requireSession();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown key." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_mcp_key", { p_id: id });
  if (error) return { ok: false, error: "Couldn't revoke the key." };
  revalidatePath("/settings");
  return { ok: true };
}
