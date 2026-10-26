import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/brand/page-header";
import { StateBadge } from "@/components/brand/state-badge";
import { requireSession, type Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Review queue" };

const ROUTE_LABEL: Record<string, string> = {
  manager: "Manager",
  legal: "Legal",
  a11y: "Accessibility",
  brand: "Brand",
};

/** Which queue items a reviewer acts on (SPEC §2, §10). RLS already limits rows to the org. */
function mine(session: Session, c: { state: string; route_to: string | null }): boolean {
  if (session.role === "brand_admin") return true;
  if (session.role === "manager") return c.state === "in_review";
  if (session.role === "specialist")
    return c.state === "specialist_review" && c.route_to === session.specialistKind;
  return false;
}

function age(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

export default async function ReviewPage() {
  const session = await requireSession();
  if (!can(session.role, "approve_or_request_changes")) return <NoAccess what="the review queue" />;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("contents")
    .select(
      "id, title, state, route_to, risk_score, updated_at, current_version_id, campaigns(name)",
    )
    .in("state", ["in_review", "specialist_review"])
    .order("risk_score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: true });
  const items = (rows ?? []).filter((c) => mine(session, c));

  const versionIds = items.map((c) => c.current_version_id).filter((v): v is string => !!v);
  const { data: open } = versionIds.length
    ? await supabase
        .from("findings")
        .select("version_id, severity")
        .in("version_id", versionIds)
        .eq("status", "open")
    : { data: [] as { version_id: string; severity: string }[] };
  const counts = new Map<string, Record<string, number>>();
  for (const f of open ?? []) {
    const c = counts.get(f.version_id) ?? {};
    c[f.severity] = (c[f.severity] ?? 0) + 1;
    counts.set(f.version_id, c);
  }

  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title="Review queue"
        description="Content waiting for your decision, highest risk first."
      />
      {items.length ? (
        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Content waiting for review, sorted by risk score then age
            </caption>
            <thead className="border-border bg-muted/60 border-b">
              <tr>
                {[
                  "Title",
                  "Campaign",
                  "Routed to",
                  "Risk",
                  "Open findings",
                  "Waiting",
                  "State",
                ].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const n = (c.current_version_id && counts.get(c.current_version_id)) || {};
                return (
                  <tr key={c.id} className="border-border border-b last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      <Link href={`/review/${c.id}`} className="underline-offset-4 hover:underline">
                        {c.title}
                      </Link>
                    </th>
                    <td className="px-4 py-3">{c.campaigns?.name}</td>
                    <td className="px-4 py-3">{ROUTE_LABEL[c.route_to ?? "manager"]}</td>
                    <td className="px-4 py-3 font-mono">{c.risk_score ?? "–"}</td>
                    <td className="px-4 py-3">
                      {["blocker", "warning", "suggestion"]
                        .filter((s) => n[s])
                        .map((s) => `${n[s]} ${s}${n[s] === 1 ? "" : "s"}`)
                        .join(", ") || "None"}
                    </td>
                    <td className="px-4 py-3">{age(c.updated_at)}</td>
                    <td className="px-4 py-3">
                      <StateBadge state={c.state} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState glyph="stamp" title="Nothing to review">
          Drafts that pass the AI check and are routed to you appear here, sorted by risk score.
        </EmptyState>
      )}
    </>
  );
}
