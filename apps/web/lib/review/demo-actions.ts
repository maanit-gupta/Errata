"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/vault/actions";

/**
 * Hero 2 demo (DEMO_MODE only): edit or restore fact E-19 so a judge, in any role, can watch the
 * real `facts_kill_switch` trigger send publish-ready content back to revision. Only E-19 in the
 * caller's own org, only these two fixed statements; the secret key is needed because non-admin
 * roles can't write facts under RLS.
 */
const CODE = "E-19";
const ORIGINAL = {
  statement: "Diwali Wealth Webinar: online only, Oct 28, 7:00 PM IST",
  value: {
    name: "Diwali Wealth Webinar",
    date: "2026-10-28",
    time: "19:00",
    tz: "Asia/Kolkata",
    venue: "online",
  },
};
const EDITED = {
  statement: "Diwali Wealth Webinar: online only, Nov 4, 7:00 PM IST",
  value: { ...ORIGINAL.value, date: "2026-11-04" },
};

async function setE19(fields: typeof ORIGINAL, done: string): Promise<ActionResult> {
  try {
    if (!clientEnv.NEXT_PUBLIC_DEMO_MODE) return { ok: false, error: "Demo mode is off." };
    const session = await requireSession();
    const { data, error } = await createAdminClient()
      .from("facts")
      .update(fields)
      .eq("org_id", session.orgId)
      .eq("code", CODE)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data.length) return { ok: false, error: `No fact ${CODE} in this org.` };
    // Re-embed the fact; best effort (only admins may enqueue vault jobs).
    await (
      await createClient()
    ).rpc("enqueue_vault_job", {
      p_org: session.orgId,
      p_job: "embed_vault",
    });
    revalidatePath("/review", "layout");
    return { ok: true, message: done };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function simulateE19Change(): Promise<ActionResult> {
  return setE19(EDITED, "E-19 edited in the vault. The kill-switch has run.");
}

export async function restoreE19(): Promise<ActionResult> {
  return setE19(ORIGINAL, "E-19 restored to its original statement.");
}
