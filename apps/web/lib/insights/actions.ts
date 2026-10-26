"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const decision = z.object({
  suggestionId: z.uuid(),
  keep: z.array(z.number().int().min(0).max(9)).max(10),
});

/**
 * A brand admin approves (some of) the generated examples for an UNCLEAR rule, or rejects them
 * all (`keep: []`). Approving appends them to the rule as version n+1 and re-embeds it
 * (`decide_example_suggestion` → `revise_rule_card`, SPEC §11).
 */
export async function decideExamples(input: z.input<typeof decision>): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!can(session.role, "define_vault"))
      return { ok: false, error: "Only brand admins can change rule cards." };
    const parsed = decision.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("decide_example_suggestion", {
      p_id: parsed.data.suggestionId,
      p_keep: parsed.data.keep,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/insights");
    revalidatePath("/vault");
    return {
      ok: true,
      message: parsed.data.keep.length
        ? `Added ${parsed.data.keep.length} example${parsed.data.keep.length === 1 ? "" : "s"} to ${data.code} as version ${data.version}. Re-embedding now.`
        : "Examples rejected. The rule is unchanged.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
