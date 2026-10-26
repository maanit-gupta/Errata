import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/brand/page-header";
import { ReviewQueue, type QueueRow } from "@/components/review/review-queue";
import { requireSession, type Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can, roleLabel } from "@/lib/workflow/permissions";

export const metadata = { title: "Review queue" };

/** Which queue items a reviewer acts on (SPEC §2, §10). RLS already limits rows to the org. */
function mine(session: Session, c: { state: string; route_to: string | null }): boolean {
  if (session.role === "brand_admin") return true;
  if (session.role === "manager") return c.state === "in_review";
  if (session.role === "specialist")
    return c.state === "specialist_review" && c.route_to === session.specialistKind;
  return false;
}

const DIM_FOR_ROUTE: Record<string, string> = { legal: "claims", a11y: "access", brand: "visual" };
const ROUTE_NAME: Record<string, string> = {
  legal: "Legal",
  a11y: "Accessibility",
  brand: "Brand",
};

export default async function ReviewPage() {
  const session = await requireSession();
  if (!can(session.role, "approve_or_request_changes"))
    return (
      <NoAccess what="the review queue" role={roleLabel(session.role, session.specialistKind)} />
    );

  const supabase = await createClient();
  const { data: contents, error } = await supabase
    .from("contents")
    .select(
      "id, title, state, route_to, risk_score, owner_id, updated_at, current_version_id, campaigns(name)",
    )
    .in("state", ["in_review", "specialist_review"]);
  if (error) throw new Error(`Couldn't load the queue: ${error.message}`);

  const versionIds = (contents ?? [])
    .map((c) => c.current_version_id)
    .filter((v): v is string => !!v);
  const [{ data: findings }, { data: profiles }] = await Promise.all([
    versionIds.length
      ? supabase
          .from("findings")
          .select(
            "version_id, severity, status, dimension, rule_cards(code), facts(code), wcag_ref",
          )
          .in("version_id", versionIds)
          .in("status", ["open", "routed"])
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));

  const rows: QueueRow[] = (contents ?? []).map((c) => {
    const fs = (findings ?? []).filter((f) => f.version_id === c.current_version_id);
    const open = { blocker: 0, warning: 0, suggestion: 0 };
    for (const f of fs) if (f.status === "open") open[f.severity] += 1;
    const route = c.state === "specialist_review" ? (c.route_to ?? "brand") : "manager";
    const codesFor = (dim: string) =>
      [
        ...new Set(
          fs
            .filter((f) => f.dimension === dim)
            .map(
              (f) =>
                f.rule_cards?.code ?? f.facts?.code ?? (f.wcag_ref ? `WCAG ${f.wcag_ref}` : null),
            ),
        ),
      ]
        .filter(Boolean)
        .join(", ");
    const reason =
      route === "manager"
        ? "rule: no open specialist findings → approver queue"
        : `rule: ${codesFor(DIM_FOR_ROUTE[route]) || DIM_FOR_ROUTE[route]} → ${ROUTE_NAME[route]} · approver queue skipped`;
    return {
      id: c.id,
      title: c.title,
      campaign: c.campaigns?.name ?? null,
      route,
      risk: c.risk_score,
      open,
      creator: name.get(c.owner_id) ?? "Someone",
      waitingSince: c.updated_at,
      reason,
      mine: mine(session, c),
    };
  });

  const tabs: ("mine" | "legal" | "a11y" | "brand" | "all")[] =
    session.role === "brand_admin"
      ? ["mine", "legal", "a11y", "brand", "all"]
      : session.role === "manager"
        ? ["mine", "all"]
        : ["mine"];

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Content waiting for a decision, highest risk first."
      />
      <ReviewQueue rows={rows} tabs={tabs} />
    </>
  );
}
