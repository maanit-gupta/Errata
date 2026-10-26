import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "./realtime-refresh";
import { RuleCardList, type RuleRow } from "./rule-card-list";
import { RuleCardPanel, type RuleDetail } from "./rule-card-panel";

const STATUSES = ["all", "draft", "approved", "archived"] as const;

export async function RuleCardsTab({
  orgId,
  status,
  cardId,
}: {
  orgId: string;
  status: string;
  cardId?: string;
}) {
  const filter = (STATUSES as readonly string[]).includes(status) ? status : "all";
  const supabase = await createClient();
  let query = supabase
    .from("rule_cards")
    .select("id, code, version, dimension, title, summary, severity, status, source_page")
    .eq("org_id", orgId)
    .order("code")
    .order("version", { ascending: false });
  query =
    filter === "all"
      ? query.neq("status", "archived")
      : query.eq("status", filter as RuleRow["status"]);
  const { data: rules } = await query;

  let detail: RuleDetail | null = null;
  if (cardId) {
    const { data } = await supabase
      .from("rule_cards")
      .select(
        "id, code, version, status, dimension, severity, title, summary, body, examples, source_page, brand_guides(storage_path)",
      )
      .eq("id", cardId)
      .maybeSingle();
    if (data) {
      let sourceUrl: string | null = null;
      const path = data.brand_guides?.storage_path;
      if (path) {
        const { data: signed } = await supabase.storage.from("guides").createSignedUrl(path, 3600);
        sourceUrl = signed?.signedUrl ?? null;
      }
      detail = {
        ...data,
        examples: Array.isArray(data.examples) ? (data.examples as RuleDetail["examples"]) : [],
        sourceUrl,
      };
    }
  }
  const closeHref = `/vault?tab=rules&status=${filter}`;

  return (
    <>
      <RealtimeRefresh orgId={orgId} tables={["rule_cards"]} />
      <nav aria-label="Filter rule cards by status" className="mb-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/vault?tab=rules&status=${s}`}
            aria-current={s === filter ? "true" : undefined}
            className="border-border aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:text-background rounded-full border px-3 py-1 text-sm"
          >
            {s === "all" ? "Active" : s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>
      <div className={detail ? "grid gap-6 lg:grid-cols-[1fr_28rem]" : ""}>
        {rules?.length ? (
          <RuleCardList rules={rules} statusParam={filter} />
        ) : (
          <EmptyState glyph="id-badge" title="No rule cards here">
            Upload a brand guide on the Guides tab to draft rule cards.
          </EmptyState>
        )}
        {detail ? <RuleCardPanel key={detail.id} rule={detail} closeHref={closeHref} /> : null}
      </div>
    </>
  );
}
