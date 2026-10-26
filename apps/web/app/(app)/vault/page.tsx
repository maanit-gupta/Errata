import { BookLock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Vault" };

export default async function VaultPage() {
  const session = await requireSession();
  if (!can(session.role, "define_vault")) return <NoAccess what="the brand vault" />;

  return (
    <>
      <PageHeader
        eyebrow="Brand vault"
        title="Rules, facts and assets"
        description="The approved rule cards, facts, glossary and assets every draft is checked against."
      />
      <EmptyState icon={BookLock} title="Vault admin is coming next">
        Upload a brand guide to draft rule cards, then approve them here.
      </EmptyState>
    </>
  );
}
