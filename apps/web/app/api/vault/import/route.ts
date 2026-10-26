import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseFactsCsv, parseGlossaryCsv } from "@/lib/vault/csv";
import { can } from "@/lib/workflow/permissions";
import type { Json } from "@/types/database";

/**
 * POST /api/vault/import — multipart form with `kind` ("facts" | "glossary") and `file` (CSV).
 * Brand admins only. Validates every row first (all-or-nothing), upserts by (org_id, code) through
 * the RLS-scoped client, then enqueues `embed_vault`. Decision logged in PROGRESS.md (P04).
 */

const MAX_BYTES = 1_000_000;
const form = z.object({ kind: z.enum(["facts", "glossary"]) });

export async function POST(request: Request) {
  const result = await getSession();
  if (result.status !== "ok")
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { session } = result;
  if (!can(session.role, "define_vault")) {
    return NextResponse.json(
      { error: "Only brand admins can import vault data." },
      { status: 403 },
    );
  }

  const data = await request.formData();
  const parsedForm = form.safeParse({ kind: data.get("kind") });
  const file = data.get("file");
  if (!parsedForm.success || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Send `kind` (facts or glossary) and a CSV `file`." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "CSV files must be under 1 MB." }, { status: 413 });
  }
  const text = await file.text();
  const supabase = await createClient();

  let imported = 0;
  if (parsedForm.data.kind === "facts") {
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("org_id", session.orgId);
    if (error) return NextResponse.json({ error: "Couldn't load campaigns." }, { status: 500 });
    const { rows, errors } = parseFactsCsv(text, campaigns ?? []);
    if (errors.length) return NextResponse.json({ errors }, { status: 422 });
    const { error: upsertError } = await supabase.from("facts").upsert(
      rows.map((r) => ({ ...r, org_id: session.orgId, value: r.value as Json })),
      { onConflict: "org_id,code" },
    );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });
    imported = rows.length;
  } else {
    const { rows, errors } = parseGlossaryCsv(text);
    if (errors.length) return NextResponse.json({ errors }, { status: 422 });
    const { error: upsertError } = await supabase.from("glossary_terms").upsert(
      rows.map((r) => ({ ...r, org_id: session.orgId })),
      { onConflict: "org_id,code" },
    );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });
    imported = rows.length;
  }

  // Facts need (re-)embedding; glossary terms are matched deterministically and aren't embedded.
  let queued = false;
  if (parsedForm.data.kind === "facts") {
    const { error } = await supabase.rpc("enqueue_vault_job", {
      p_org: session.orgId,
      p_job: "embed_vault",
    });
    queued = !error;
  }
  return NextResponse.json({ kind: parsedForm.data.kind, imported, embeddingQueued: queued });
}
