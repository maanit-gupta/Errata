"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, type Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";
import type { Json } from "@/types/database";

/** Vault mutations (P05). Every action re-checks the role; RLS and SQL functions enforce it too. */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function admin(): Promise<Session> {
  const session = await requireSession();
  if (!can(session.role, "define_vault"))
    throw new Error("Only brand admins can change the vault.");
  return session;
}

function fail(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

const DIMENSIONS = ["tone", "terms", "facts", "claims", "visual", "access"] as const;
const SEVERITIES = ["blocker", "warning", "suggestion"] as const;

// ------------------------------------------------------------------ guides

const MAX_GUIDE_BYTES = 20 * 1024 * 1024;

export async function uploadGuide(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await admin();
    const supabase = await createClient();
    const url = String(formData.get("url") ?? "").trim();
    const file = formData.get("file");
    const id = crypto.randomUUID();

    let row: {
      source_kind: "pdf" | "docx" | "url";
      storage_path: string | null;
      source_url: string | null;
      title: string;
    };
    if (url) {
      const parsed = z.url({ protocol: /^https?$/ }).safeParse(url);
      if (!parsed.success) return { ok: false, error: "Enter a full http(s) URL." };
      row = {
        source_kind: "url",
        storage_path: null,
        source_url: url,
        title: new URL(url).hostname,
      };
    } else if (file instanceof File && file.size > 0) {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "pdf" && ext !== "docx")
        return { ok: false, error: "Upload a PDF or DOCX file." };
      if (file.size > MAX_GUIDE_BYTES) return { ok: false, error: "Guides must be under 20 MB." };
      const path = `${session.orgId}/${id}/${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage
        .from("guides")
        .upload(path, file, { contentType: file.type });
      if (error) return { ok: false, error: `Upload failed: ${error.message}` };
      row = {
        source_kind: ext,
        storage_path: path,
        source_url: null,
        title: file.name.replace(/\.(pdf|docx)$/i, ""),
      };
    } else {
      return { ok: false, error: "Choose a file or paste a URL." };
    }

    const { error } = await supabase
      .from("brand_guides")
      .insert({ id, org_id: session.orgId, created_by: session.userId, ...row });
    if (error) return { ok: false, error: error.message };
    const { error: qErr } = await supabase.rpc("enqueue_vault_job", {
      p_org: session.orgId,
      p_job: "ingest_guide",
      p_payload: { guide_id: id },
    });
    if (qErr) return { ok: false, error: `Saved, but couldn't start parsing: ${qErr.message}` };
    revalidatePath("/vault");
    return {
      ok: true,
      message: "Guide uploaded. Draft rule cards will appear here as they're extracted.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ rule cards

export async function approveRuleCards(ids: string[]): Promise<ActionResult> {
  try {
    await admin();
    const parsed = z.array(z.uuid()).min(1).max(200).safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Nothing to approve." };
    const supabase = await createClient();
    for (const id of parsed.data) {
      const { error } = await supabase.rpc("approve_rule_card", { p_id: id });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/vault");
    return {
      ok: true,
      message:
        parsed.data.length === 1 ? "Rule approved." : `${parsed.data.length} rules approved.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveRuleCard(id: string): Promise<ActionResult> {
  try {
    await admin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("rule_cards")
      .update({ status: "archived" })
      .eq("id", z.uuid().parse(id));
    if (error) return { ok: false, error: error.message };
    revalidatePath("/vault");
    return { ok: true, message: "Rule archived." };
  } catch (e) {
    return fail(e);
  }
}

const exampleSchema = z.object({
  kind: z.enum(["do", "dont"]),
  text: z.string().trim().min(1).max(400),
});
const ruleEdit = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Title is required").max(160),
  summary: z.string().trim().min(1, "Summary is required").max(400),
  body: z.string().trim().min(1, "Body is required").max(2000),
  severity: z.enum(SEVERITIES),
  dimension: z.enum(DIMENSIONS),
  examples: z.array(exampleSchema).max(6),
});
export type RuleEdit = z.infer<typeof ruleEdit>;

export async function saveRuleCard(input: RuleEdit): Promise<ActionResult & { id?: string }> {
  try {
    await admin();
    const parsed = ruleEdit.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const supabase = await createClient();
    const examples = d.examples.map((e) => ({ ...e, source: "guide" }));
    const { data, error } = await supabase.rpc("revise_rule_card", {
      p_id: d.id,
      p_title: d.title,
      p_summary: d.summary,
      p_body: d.body,
      p_examples: examples as Json,
      p_severity: d.severity,
      p_dimension: d.dimension,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/vault");
    const bumped = data && data.id !== d.id;
    return {
      ok: true,
      id: data?.id,
      message: bumped ? `Saved as version ${data.version}.` : "Saved.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ facts & glossary

const factEdit = z.object({
  id: z.uuid(),
  statement: z.string().trim().min(1, "Statement is required"),
  value: z.string().transform((s, ctx) => {
    try {
      const v: unknown = JSON.parse(s || "{}");
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Json;
    } catch {}
    ctx.addIssue({ code: "custom", message: "Value must be a JSON object." });
    return z.NEVER;
  }),
  required_disclaimer: z
    .string()
    .trim()
    .transform((s) => s || null),
  valid_until: z
    .string()
    .trim()
    .transform((s) => (s ? new Date(s).toISOString() : null)),
  never_send: z.boolean(),
});
export type FactEdit = z.input<typeof factEdit>;

export async function saveFact(input: FactEdit): Promise<ActionResult> {
  try {
    const session = await admin();
    const parsed = factEdit.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { id, ...fields } = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase
      .from("facts")
      .update(fields)
      .eq("id", id)
      .eq("org_id", session.orgId);
    if (error) return { ok: false, error: error.message };
    await supabase.rpc("enqueue_vault_job", { p_org: session.orgId, p_job: "embed_vault" });
    revalidatePath("/vault");
    return { ok: true, message: "Fact saved." };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ campaigns

const campaign = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Name is required").max(120),
    starts_on: z
      .string()
      .trim()
      .transform((s) => s || null),
    ends_on: z
      .string()
      .trim()
      .transform((s) => s || null),
    status: z.enum(["planned", "active", "ended"]),
  })
  .refine((c) => !c.starts_on || !c.ends_on || c.ends_on >= c.starts_on, {
    message: "The end date must be on or after the start date.",
  });

export async function saveCampaign(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await admin();
    const parsed = campaign.safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      starts_on: formData.get("starts_on") ?? "",
      ends_on: formData.get("ends_on") ?? "",
      status: formData.get("status"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { id, ...fields } = parsed.data;
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("campaigns").update(fields).eq("id", id)
      : await supabase.from("campaigns").insert({ ...fields, org_id: session.orgId });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/vault");
    return { ok: true, message: id ? "Campaign saved." : "Campaign created." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  try {
    await admin();
    const supabase = await createClient();
    const { error } = await supabase.from("campaigns").delete().eq("id", z.uuid().parse(id));
    if (error) {
      return { ok: false, error: "This campaign has content or facts. Mark it ended instead." };
    }
    revalidatePath("/vault");
    return { ok: true, message: "Campaign deleted." };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ assets

const HEX = /^#[0-9a-fA-F]{6}$/;
const palette = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  colours: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        hex: z.string().regex(HEX, "Use #RRGGBB"),
      }),
    )
    .min(1)
    .max(24),
  max_delta_e: z.number().min(1).max(50),
});
export type PaletteInput = z.infer<typeof palette>;

export async function savePalette(input: PaletteInput): Promise<ActionResult> {
  try {
    const session = await admin();
    const parsed = palette.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { id, name, colours, max_delta_e } = parsed.data;
    const spec = {
      colours: colours.map((c) => ({ ...c, hex: c.hex.toUpperCase() })),
      max_delta_e,
    } as Json;
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("assets").update({ name, spec }).eq("id", id)
      : await supabase
          .from("assets")
          .insert({ org_id: session.orgId, kind: "palette", name, spec });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/vault");
    return { ok: true, message: "Palette saved." };
  } catch (e) {
    return fail(e);
  }
}

const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export async function uploadAsset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await admin();
    const kind = z.enum(["logo", "reference_image"]).parse(formData.get("kind"));
    const name = z.string().trim().min(1, "Name is required").max(80).parse(formData.get("name"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      return { ok: false, error: "Use a PNG, JPEG, WebP or SVG image." };
    }
    if (file.size > MAX_ASSET_BYTES) return { ok: false, error: "Images must be under 10 MB." };
    const spec =
      kind === "logo"
        ? {
            min_clear_space_ratio: z.coerce
              .number()
              .min(0)
              .max(2)
              .parse(formData.get("min_clear_space_ratio") || 0.25),
            min_width_px: z.coerce
              .number()
              .int()
              .min(1)
              .max(4000)
              .parse(formData.get("min_width_px") || 80),
          }
        : {};
    const supabase = await createClient();
    const path = `${session.orgId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("assets")
      .upload(path, file, { contentType: file.type });
    if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };
    const { error } = await supabase
      .from("assets")
      .insert({ org_id: session.orgId, kind, name, storage_path: path, spec: spec as Json });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/vault");
    return { ok: true, message: "Asset uploaded." };
  } catch (e) {
    return fail(e);
  }
}
