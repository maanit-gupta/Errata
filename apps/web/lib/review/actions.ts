"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { notifyDiscord, type NotifyEvent } from "@/lib/notify/discord";
import { notifyEmail } from "@/lib/notify/email";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Reviewer decisions (SPEC §4). Every state change goes through `transition_content()`, which
 * enforces roles and guards in SQL; these actions only translate errors into plain language and
 * fire notifications after the response (SPEC §15).
 */

type ContentState = Database["public"]["Enums"]["content_state"];
export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

const contentId = z.uuid();
const reason = (label: string) => z.string().trim().min(3, `Add a reason for ${label}.`).max(1000);

function friendly(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "42501":
      return "Your role can't do that for this content.";
    case "22023":
      return "That isn't a valid next step from the content's current state.";
    case "P0002":
      return "This content no longer exists or isn't visible to you.";
    case "23514":
      return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
    default:
      return error.message;
  }
}

async function transition(
  id: string,
  to: ContentState,
  opts: {
    reason?: string;
    routeTo?: string;
    notify?: (row: { title: string; owner_id: string }) => NotifyEvent | null;
  } = {},
): Promise<ReviewResult> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_content", {
    p_content_id: contentId.parse(id),
    p_to: to,
    p_reason: opts.reason,
    p_route_to: opts.routeTo,
  });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/review/${id}`);
  revalidatePath("/review");
  const event = opts.notify?.({ title: data.title, owner_id: data.owner_id }) ?? null;
  if (event) {
    after(async () => {
      await notifyDiscord(event);
      await notifyEmail(event, data.owner_id);
    });
  }
  return { ok: true, message: "Done." };
}

const approval = z.object({
  contentId,
  overrides: z.array(z.object({ findingId: z.uuid(), reason: reason("each override") })).max(50),
});

/** Manager/admin approval. Each open warning needs an `override` decision with a reason first. */
export async function approve(input: z.input<typeof approval>): Promise<ReviewResult> {
  const session = await requireSession();
  const parsed = approval.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select("org_id, current_version_id")
    .eq("id", parsed.data.contentId)
    .single();
  if (!content?.current_version_id) return { ok: false, error: "Nothing to approve yet." };
  for (const o of parsed.data.overrides) {
    const { error } = await supabase.from("decisions").insert({
      org_id: content.org_id,
      version_id: content.current_version_id,
      actor_id: session.userId,
      action: "override",
      finding_id: o.findingId,
      reason: o.reason,
    });
    if (error) return { ok: false, error: friendly({ code: error.code, message: error.message }) };
  }
  const r = await transition(parsed.data.contentId, "approved", {
    notify: (c) => ({ type: "approved", contentId: parsed.data.contentId, title: c.title }),
  });
  return r.ok ? { ok: true, message: "Approved." } : r;
}

export async function signOff(id: string, why: string): Promise<ReviewResult> {
  const parsed = reason("the sign-off").safeParse(why);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = await transition(id, "approved", {
    reason: parsed.data,
    notify: (c) => ({ type: "approved", contentId: id, title: c.title }),
  });
  return r.ok ? { ok: true, message: "Signed off." } : r;
}

export async function requestChanges(id: string, why: string): Promise<ReviewResult> {
  const parsed = reason("requesting changes").safeParse(why);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = await transition(id, "changes_requested", {
    reason: parsed.data,
    notify: (c) => ({
      type: "changes_requested",
      contentId: id,
      title: c.title,
      reason: parsed.data,
    }),
  });
  return r.ok ? { ok: true, message: "Changes requested. The owner has been told." } : r;
}

export async function escalate(id: string, routeTo: string, why: string): Promise<ReviewResult> {
  const route = z.enum(["legal", "a11y", "brand"]).safeParse(routeTo);
  if (!route.success) return { ok: false, error: "Pick who should review it." };
  const r = await transition(id, "specialist_review", {
    reason: why.trim() || undefined,
    routeTo: route.data,
    notify: (c) => ({
      type: "needs_review",
      contentId: id,
      title: c.title,
      routeTo: route.data,
      risk: null,
    }),
  });
  return r.ok ? { ok: true, message: "Sent to the specialist." } : r;
}

export async function markPublishReady(id: string): Promise<ReviewResult> {
  const r = await transition(id, "publish_ready", {
    notify: (c) => ({ type: "publish_ready", contentId: id, title: c.title }),
  });
  return r.ok ? { ok: true, message: "Marked publish-ready. Errata never publishes for you." } : r;
}

export async function archive(id: string, why: string): Promise<ReviewResult> {
  const r = await transition(id, "archived", { reason: why.trim() || undefined });
  return r.ok ? { ok: true, message: "Archived. History is kept." } : r;
}

/** Owner: take content back to draft to revise it (needs_revision / changes_requested → draft). */
export async function revise(id: string): Promise<ReviewResult> {
  const r = await transition(id, "draft");
  revalidatePath(`/drafts/${id}`);
  return r.ok ? { ok: true, message: "Back in draft. Edit and resubmit when ready." } : r;
}

// ------------------------------------------------------------------ comments

const comment = z.object({
  contentId,
  versionId: z.uuid(),
  body: z.string().trim().min(1, "Write a comment.").max(2000),
  findingId: z.uuid().optional(),
  parentId: z.uuid().optional(),
});

export async function addComment(input: z.input<typeof comment>): Promise<ReviewResult> {
  const session = await requireSession();
  const parsed = comment.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { versionId, body, findingId, parentId } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    org_id: session.orgId,
    version_id: versionId,
    author_id: session.userId,
    body,
    parent_id: parentId ?? null,
    anchor: findingId ? { type: "finding", finding_id: findingId } : null,
  });
  if (error) return { ok: false, error: friendly({ code: error.code, message: error.message }) };
  revalidatePath(`/review/${parsed.data.contentId}`);
  return { ok: true, message: "Comment added." };
}
