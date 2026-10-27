import { EmptyState } from "@/components/brand/empty-state";
import { IllustrativeDataPill } from "@/components/brand/illustrative-pill";
import { KpiTile } from "@/components/brand/kpi-tile";
import type { Issue } from "@/components/insights/issues-chart";
import { IssuesView } from "@/components/insights/issues-view";
import {
  Watchlist,
  type GcsStatus,
  type SuggestedExample,
  type WatchRow,
} from "@/components/insights/watchlist";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/brand/page-header";
import { RealtimeRefresh } from "@/components/vault/realtime-refresh";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Insights" };

type Summary = {
  versions_checked: number;
  avg_brand_fit: number | null;
  first_review_approval_pct: number | null;
  reviews: number;
  median_days_to_approval: number | null;
  blockers_this_week: number;
  top_issues: Issue[];
  simulated: boolean;
};

const ORDER: Record<GcsStatus, number> = { unclear: 0, watch: 1, clear: 2, insufficient: 3 };

export default async function InsightsPage() {
  const session = await requireSession();
  if (!can(session.role, "view_insights")) return <NoAccess what="insights" />;
  const supabase = await createClient();

  const [{ data: summaryRaw, error }, { data: scores }, { data: suggestions }] = await Promise.all([
    supabase.rpc("insights_summary", { p_org: session.orgId }),
    supabase.rpc("rule_gcs", { p_org: session.orgId }),
    supabase
      .from("example_suggestions")
      .select("id, rule_id, examples, status")
      .eq("status", "pending"),
  ]);
  if (error) throw new Error(error.message);
  const summary = summaryRaw as unknown as Summary;
  const all = scores ?? [];

  const current = all.filter((s) => s.card_status === "approved");
  const { data: cards } = current.length
    ? await supabase
        .from("rule_cards")
        .select("id, examples")
        .in(
          "id",
          current.map((c) => c.rule_id),
        )
    : { data: [] };
  const generated = new Map(
    (cards ?? []).map((c) => [
      c.id,
      ((c.examples ?? []) as { source?: string }[]).filter((e) => e.source === "generated").length,
    ]),
  );
  const rows: WatchRow[] = current
    .map((s) => {
      const previous = all
        .filter((p) => p.code === s.code && p.version < s.version && p.n > 0)
        .sort((a, b) => b.version - a.version)[0];
      const suggestion = (suggestions ?? []).find((x) => x.rule_id === s.rule_id);
      return {
        ruleId: s.rule_id,
        code: s.code,
        title: s.title,
        version: s.version,
        n: s.n,
        gcs: s.gcs,
        status: s.status as GcsStatus,
        previous: previous
          ? { version: previous.version, gcs: previous.gcs, status: previous.status as GcsStatus }
          : null,
        suggestion: suggestion
          ? { id: suggestion.id, examples: suggestion.examples as SuggestedExample[] }
          : null,
        added: generated.get(s.rule_id) ?? 0,
      };
    })
    .filter((r) => r.n > 0 || r.previous)
    .sort(
      (a, b) => ORDER[a.status] - ORDER[b.status] || (a.gcs ?? 101) - (b.gcs ?? 101) || b.n - a.n,
    );
  const quiet = current.length - rows.length;

  const tiles = [
    {
      value: summary.avg_brand_fit ?? "–",
      label: "avg. brand-fit score",
      help: "100 − 10 per blocker − 3 per warning, per checked version",
    },
    {
      value:
        summary.first_review_approval_pct != null ? `${summary.first_review_approval_pct}%` : "–",
      label: "approved on first review",
      help: `${summary.reviews} reviewed`,
    },
    {
      value: summary.median_days_to_approval != null ? `${summary.median_days_to_approval} d` : "–",
      label: "median time to approval",
      help: "first version to approval",
    },
    { value: summary.blockers_this_week, label: "blockers caught this week", help: "last 7 days" },
  ];

  return (
    <>
      <RealtimeRefresh orgId={session.orgId} tables={["example_suggestions", "rule_cards"]} />
      <PageHeader
        eyebrow="Insights · last 30 days"
        title="Guideline health"
        description="Which rules are clear, which keep getting dismissed, and where reviews slow down."
        meta={summary.simulated ? <IllustrativeDataPill /> : null}
      />

      {!summary.versions_checked && !rows.length ? (
        <EmptyState glyph="chart-bars" title="Not enough reviews yet">
          Guideline Clarity Scores appear once a rule has at least 10 findings.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="kpi-h">
            <h2 id="kpi-h" className="sr-only">
              Key figures
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map((t) => (
                <KpiTile
                  key={t.label}
                  label={t.label}
                  value={<span className="tabular-nums">{t.value}</span>}
                  delta={t.help}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="issues-h" className="space-y-3">
            <h2 id="issues-h" className="mono-label text-fg-faint">
              Top recurring issues · 30 days
            </h2>
            {summary.top_issues.length ? (
              <IssuesView issues={summary.top_issues} />
            ) : (
              <p className="text-fg-muted text-sm">No findings in the last 30 days.</p>
            )}
          </section>

          {session.role === "manager" ? (
            <p className="text-fg-muted text-sm">
              Managers see team figures. The per-rule watchlist is for brand admins.
            </p>
          ) : (
            <section aria-labelledby="watch-h" className="space-y-3">
              <div>
                <h2 id="watch-h" className="mono-label text-fg-faint">
                  Guideline watchlist
                </h2>
                <p className="text-fg-muted max-w-3xl text-sm">
                  Guideline Clarity Score = 100 × (1 − [0.45 × dismissed as “doesn&apos;t apply” +
                  0.35 × reviewer overrides + 0.20 × low-confidence findings]), from 10 findings up.
                  Below 65 is UNCLEAR and gets suggested examples; 65–75 is watch. A new version of
                  a rule starts a fresh score.
                </p>
              </div>
              <Watchlist rows={rows} canDecide={can(session.role, "define_vault")} />
              {quiet > 0 ? (
                <p className="text-fg-muted text-xs">
                  {quiet} more approved rule{quiet === 1 ? " has" : "s have"} no findings yet.
                </p>
              ) : null}
            </section>
          )}
        </div>
      )}
    </>
  );
}
