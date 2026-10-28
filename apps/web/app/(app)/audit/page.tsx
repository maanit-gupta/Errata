import { PageHeader } from "@/components/brand/page-header";
import { NoAccess } from "@/components/no-access";
import { AuditLog, type AuditRow } from "@/components/review/audit-log";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can, roleLabel, type Role } from "@/lib/workflow/permissions";

export const metadata = { title: "Audit log" };

/** Global audit log (DESIGN.md §6.8). RLS limits `audit_events` to managers, specialists, admins. */
export default async function AuditPage() {
  const session = await requireSession();
  if (!can(session.role, "view_audit_log"))
    return <NoAccess what="the audit log" role={roleLabel(session.role, session.specialistKind)} />;

  const supabase = await createClient();
  const [
    { data: events, error },
    { data: profiles },
    { data: members },
    { data: contents },
    { data: versions },
  ] = await Promise.all([
    supabase
      .from("audit_events")
      .select("id, actor_id, event, at")
      .eq("org_id", session.orgId)
      .order("at", { ascending: false })
      .limit(1000),
    supabase.from("profiles").select("id, display_name"),
    supabase
      .from("memberships")
      .select("user_id, role, specialist_kind")
      .eq("org_id", session.orgId),
    supabase.from("contents").select("id, title").eq("org_id", session.orgId),
    supabase.from("versions").select("id, content_id"),
  ]);
  if (error) throw new Error(`Couldn't load the audit log: ${error.message}`);
  const name = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));
  const role = new Map(
    (members ?? []).map((m) => [m.user_id, roleLabel(m.role as Role, m.specialist_kind)]),
  );
  const title = new Map((contents ?? []).map((c) => [c.id, c.title]));
  const contentOfVersion = new Map((versions ?? []).map((v) => [v.id, v.content_id]));

  const rows: AuditRow[] = (events ?? []).map((a) => {
    const e = (a.event ?? {}) as Record<string, string | null | undefined>;
    const contentId =
      e.content_id ?? (e.version_id ? (contentOfVersion.get(e.version_id) ?? null) : null);
    const type = String(e.type ?? "event");
    return {
      id: a.id,
      at: a.at,
      actor: a.actor_id ? (name.get(a.actor_id) ?? "Someone") : "Errata",
      role: a.actor_id ? (role.get(a.actor_id) ?? null) : "system",
      contentId,
      content: contentId ? (title.get(contentId) ?? null) : null,
      type,
      event:
        type === "transition"
          ? `${e.from} → ${e.to}`
          : type === "finding_status"
            ? `finding ${e.from} → ${e.to}`
            : type,
      reason: e.reason ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every state change and finding decision, with who did it and why. Times are IST."
      />
      <AuditLog rows={rows} />
    </>
  );
}
