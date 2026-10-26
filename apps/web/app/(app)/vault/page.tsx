import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/brand/page-header";
import { AssetsTab } from "@/components/vault/assets-tab";
import { CampaignsTab } from "@/components/vault/campaigns-tab";
import { FactsTab } from "@/components/vault/facts-tab";
import { GlossaryTab } from "@/components/vault/glossary-tab";
import { GuidesTab } from "@/components/vault/guides-tab";
import { RuleCardsTab } from "@/components/vault/rule-cards-tab";
import { VAULT_TABS, VaultTabs, type VaultTab } from "@/components/vault/vault-tabs";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Vault" };

export default async function VaultPage({ searchParams }: PageProps<"/vault">) {
  const session = await requireSession();
  // SPEC §2: only brand admins define the vault; agencies never see it.
  if (!can(session.role, "define_vault")) return <NoAccess what="the brand vault" />;

  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const requested = str(params.tab);
  const tab: VaultTab = VAULT_TABS.some((t) => t.key === requested)
    ? (requested as VaultTab)
    : "rules";

  return (
    <>
      <PageHeader
        eyebrow="Brand vault"
        title="Rules, facts and assets"
        description="Every draft is checked against what's approved here, and every finding cites it."
      />
      <VaultTabs active={tab} />
      {tab === "rules" ? (
        <RuleCardsTab
          orgId={session.orgId}
          status={str(params.status) ?? "all"}
          cardId={str(params.card)}
        />
      ) : null}
      {tab === "facts" ? <FactsTab orgId={session.orgId} /> : null}
      {tab === "glossary" ? <GlossaryTab orgId={session.orgId} /> : null}
      {tab === "campaigns" ? <CampaignsTab orgId={session.orgId} /> : null}
      {tab === "assets" ? <AssetsTab orgId={session.orgId} /> : null}
      {tab === "guides" ? <GuidesTab orgId={session.orgId} /> : null}
    </>
  );
}
