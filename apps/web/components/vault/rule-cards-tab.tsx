import { EmptyState } from "@/components/brand/empty-state";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "./realtime-refresh";
import { RuleCardList, type RuleRow } from "./rule-card-list";
import { RuleCardPanel, type RuleDetail } from "./rule-card-panel";
import { SIGNED_URL_TTL_S } from "@/lib/limits";
import { StatusTabs } from "./status-tabs";

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
  const { data: all, error } = await supabase
    .from("rule_cards")
    .select(
      "id, code, version, dimension, title, summary, severity, status, source_page, never_send",
    )
    .eq("org_id", orgId)
    .order("code")
    .order("version", { ascending: false });
  if (error) throw new Error(`Couldn't load rule cards: ${error.message}`);
  const rules = (all ?? []).filter((r) =>
    filter === "all" ? r.status !== "archived" : r.status === filter,
  ) as RuleRow[];
  const count = (s: string) => (all ?? []).filter((r) => r.status === s).length;

  let detail: RuleDetail | null = null;
  if (cardId) {
    const { data } = await supabase
      .from("rule_cards")
      .select(
        "id, code, version, status, dimension, severity, title, summary, body, examples, source_page, never_send, brand_guides(storage_path)",
      )
      .eq("id", cardId)
      .maybeSingle();
    if (data) {
      let sourceUrl: string | null = null;
      const path = data.brand_guides?.storage_path;
      if (path) {
        const { data: signed } = await supabase.storage
          .from("guides")
          .createSignedUrl(path, SIGNED_URL_TTL_S);
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
      <StatusTabs
        label="Filter rule cards by status"
        value={filter}
        tabs={[
          {
            value: "all",
            label: "Active",
            count: (all ?? []).length - count("archived"),
            href: "/vault?tab=rules&status=all",
          },
          {
            value: "draft",
            label: "Draft",
            count: count("draft"),
            href: "/vault?tab=rules&status=draft",
          },
          {
            value: "approved",
            label: "Approved",
            count: count("approved"),
            href: "/vault?tab=rules&status=approved",
          },
          {
            value: "archived",
            label: "Archived",
            count: count("archived"),
            href: "/vault?tab=rules&status=archived",
          },
        ]}
      >
        {rules.length ? (
          <RuleCardList rules={rules} statusParam={filter} />
        ) : (
          <EmptyState glyph="rule-card" title="No rule cards here">
            Upload a brand guide on the Guides tab to draft rule cards.
          </EmptyState>
        )}
      </StatusTabs>
      {detail ? <RuleCardPanel key={detail.id} rule={detail} closeHref={closeHref} /> : null}
    </>
  );
}
