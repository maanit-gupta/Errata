import "server-only";
import type { Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ShellData = {
  /** Review-queue items this user acts on. */
  queueCount: number | null;
  /** The user's checks still queued or running. */
  activeRuns: { count: number; href: string | null };
};

/** Small, RLS-scoped reads for the sidebar and top bar. Failures degrade to empty, never throw. */
export async function getShellData(session: Session): Promise<ShellData> {
  const supabase = await createClient();
  const reviewer = ["manager", "specialist", "brand_admin"].includes(session.role);

  const [queue, runs] = await Promise.all([
    reviewer
      ? supabase
          .from("contents")
          .select("id, state, route_to")
          .in("state", ["in_review", "specialist_review"])
      : Promise.resolve({ data: null }),
    supabase
      .from("review_runs")
      .select("id, status, versions!inner(content_id, contents!inner(owner_id))")
      .in("status", ["queued", "running"])
      .eq("versions.contents.owner_id", session.userId)
      .limit(5),
  ]);

  const queueCount = queue.data
    ? queue.data.filter((c) => {
        if (session.role === "brand_admin") return true;
        if (session.role === "manager") return c.state === "in_review";
        return c.state === "specialist_review" && c.route_to === session.specialistKind;
      }).length
    : null;

  const active = runs.data ?? [];
  const first = active[0] as { versions?: { content_id?: string } } | undefined;

  return {
    queueCount,
    activeRuns: {
      count: active.length,
      href: first?.versions?.content_id ? `/drafts/${first.versions.content_id}` : null,
    },
  };
}
