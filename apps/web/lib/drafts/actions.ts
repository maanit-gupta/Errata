"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { serverEnv } from "@/lib/env";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";
import type { Json } from "@/types/database";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/limits";
import { intentSchema } from "./intent";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const fail = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong.",
});

// ------------------------------------------------------------------ create

const newDraft = z.object({
  title: z.string().trim().min(1, "Give it a title.").max(140),
  channel: z.string().trim().min(1),
  campaign_id: z.uuid("Pick a campaign."),
});

export async function createDraft(_prev: Result | null, formData: FormData): Promise<Result> {
  const session = await requireSession();
  if (!can(session.role, "submit_content"))
    return { ok: false, error: "Your role can't create drafts." };
  const parsed = newDraft.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contents")
    .insert({ ...parsed.data, org_id: session.orgId, owner_id: session.userId })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  redirect(`/drafts/${data.id}`);
}

// ------------------------------------------------------------------ submit

const submission = z.object({
  contentId: z.uuid(),
  body: z.string().max(40_000),
  intent: intentSchema,
});

const UPLOAD_FORMATS: Record<string, "docx" | "pdf" | "image"> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

/** Save a new immutable version and queue the review (draft → ai_check, or resubmit). */
export async function submitForCheck(
  input: z.input<typeof submission>,
  upload?: FormData,
): Promise<Result> {
  try {
    const session = await requireSession();
    const parsed = submission.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { contentId, body, intent } = parsed.data;
    const supabase = await createClient();

    let storagePath: string | null = null;
    let format: "text" | "docx" | "pdf" | "image" = "text";
    const file = upload?.get("file");
    if (file instanceof File && file.size > 0) {
      const kind = UPLOAD_FORMATS[file.type];
      if (!kind) return { ok: false, error: "Upload a DOCX, PDF, PNG, JPEG or WebP file." };
      if (file.size > MAX_UPLOAD_BYTES)
        return { ok: false, error: `Files must be under ${MAX_UPLOAD_LABEL}.` };
      storagePath = `${session.orgId}/${contentId}/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage
        .from("drafts")
        .upload(storagePath, file, { contentType: file.type });
      if (error) return { ok: false, error: `Upload failed: ${error.message}` };
      format = kind;
    } else if (!body.trim()) {
      return { ok: false, error: "Write something or upload a file first." };
    }

    const { data: version, error } = await supabase
      .from("versions")
      .insert({
        content_id: contentId,
        n: 0, // assigned by the versions_number trigger
        body: format === "text" ? body : null,
        storage_path: storagePath,
        format,
        intent: intent as Json,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: friendly(error.message) };

    const { error: qErr } = await supabase.rpc("enqueue_review", { p_version_id: version.id });
    if (qErr) {
      if (qErr.code === "BL429")
        return {
          ok: false,
          error:
            "Saved, but you've submitted 10 checks in the last minute. Wait a moment and submit again.",
        };
      return { ok: false, error: friendly(qErr.message) };
    }
    wakeWorker();
    revalidatePath(`/drafts/${contentId}`);
    return { ok: true, message: "Submitted. Findings will appear here in a few seconds." };
  } catch (e) {
    return fail(e);
  }
}

/** Free-tier hosts sleep when idle; a /healthz ping wakes the worker so it drains the queue. */
function wakeWorker() {
  const url = serverEnv().WORKER_URL;
  if (!url) return;
  after(async () => {
    try {
      await fetch(`${url.replace(/\/$/, "")}/healthz`, { signal: AbortSignal.timeout(60_000) });
    } catch {
      // best effort; the job stays queued until the worker is up
    }
  });
}

function friendly(message: string): string {
  if (message.includes("row-level security"))
    return "This draft can't be changed in its current state.";
  return message;
}

// ------------------------------------------------------------------ findings

const resolution = z.discriminatedUnion("status", [
  z.object({ id: z.uuid(), status: z.literal("accepted") }),
  z.object({ id: z.uuid(), status: z.literal("edited") }),
  z.object({ id: z.uuid(), status: z.literal("routed") }),
  z.object({ id: z.uuid(), status: z.literal("open") }),
  z.object({
    id: z.uuid(),
    status: z.literal("dismissed"),
    dismiss_reason: z.enum(["approved_exception", "doesnt_apply", "ai_wrong"], "Choose a reason."),
    dismiss_note: z.string().trim().max(500).optional(),
  }),
]);

/** Accept / edit / dismiss / route a finding. The DB trigger stamps the resolver and audits it. */
export async function resolveFinding(input: z.input<typeof resolution>): Promise<Result> {
  try {
    await requireSession();
    const parsed = resolution.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { id, ...fields } = parsed.data;
    const supabase = await createClient();

    if (fields.status === "routed") {
      const { data: f } = await supabase
        .from("findings")
        .select("dimension, severity")
        .eq("id", id)
        .single();
      if (!f || f.dimension !== "claims" || f.severity !== "blocker") {
        return { ok: false, error: "Only claims blockers can be routed to legal." };
      }
    }
    const { data, error } = await supabase
      .from("findings")
      .update({
        status: fields.status,
        dismiss_reason: fields.status === "dismissed" ? fields.dismiss_reason : null,
        dismiss_note: fields.status === "dismissed" ? (fields.dismiss_note ?? null) : null,
      })
      .eq("id", id)
      .select("id, version_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "You can't change this finding." };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
