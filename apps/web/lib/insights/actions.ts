"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
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

// ------------------------------------------------------------------ Hero 5: GCS shadow sandbox

const simulateInput = z.object({
  ruleId: z.uuid(),
  doExamples: z
    .array(z.string().trim().min(1).max(300))
    .min(1, "Keep at least one Do example.")
    .max(10),
  dontExamples: z.array(z.string().trim().min(1).max(300)).max(10),
  includeSimulated: z.boolean(),
});

const shadowSchema = z.object({
  rule_code: z.string(),
  status: z.enum(["projection", "insufficient_data"]),
  sample_size: z.number().int(),
  current_gcs: z.number().int().nullable(),
  current_status: z.string(),
  dismissal_rate_now: z.number().nullable(),
  override_rate: z.number().nullable(),
  low_confidence_rate: z.number().nullable(),
  sample_dismissal_rate: z.number().nullable(),
  projected_dismissal_rate: z.number().nullable(),
  projected_gcs: z.number().int().nullable(),
  projected_status: z.string().nullable(),
  false_positives_removed: z.number().int(),
  true_positives_lost: z.number().int(),
  note: z.string(),
  elapsed_ms: z.number(),
});
export type ShadowResult = z.infer<typeof shadowSchema>;

/**
 * Backtest candidate examples on the rule's recent findings (worker, local embeddings only). The
 * worker re-verifies the caller's session with Supabase Auth and checks their role in the rule's
 * organisation; this action only forwards the user's own token.
 */
export async function simulateRuleShadow(
  input: z.input<typeof simulateInput>,
): Promise<{ ok: true; result: ShadowResult } | { ok: false; error: string }> {
  const session = await requireSession();
  if (session.role !== "brand_admin" && session.role !== "manager")
    return { ok: false, error: "Only brand admins and managers can run the simulator." };
  const parsed = simulateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const workerUrl = serverEnv().WORKER_URL;
  if (!workerUrl)
    return { ok: false, error: "The simulator runs on the worker, and WORKER_URL isn't set." };
  const supabase = await createClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return { ok: false, error: "Sign in again to run the simulator." };
  try {
    const res = await fetch(`${workerUrl.replace(/\/+$/, "")}/v1/heroes/simulate-rule`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        rule_id: parsed.data.ruleId,
        do_examples: parsed.data.doExamples,
        dont_examples: parsed.data.dontExamples,
        include_simulated: parsed.data.includeSimulated,
      }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, error: "Sign in again to run the simulator." };
    if (res.status === 404) return { ok: false, error: "That rule isn't available to you." };
    if (res.status === 429) return { ok: false, error: "Too many runs. Try again in a minute." };
    if (!res.ok) return { ok: false, error: `The simulator failed (HTTP ${res.status}).` };
    const result = shadowSchema.safeParse(await res.json());
    if (!result.success) return { ok: false, error: "The simulator sent an unexpected answer." };
    return { ok: true, result: result.data };
  } catch {
    return { ok: false, error: "Couldn't reach the worker. It may be waking up; try again." };
  }
}
