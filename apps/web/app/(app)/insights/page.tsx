import { ChartNoAxesColumn } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  const session = await requireSession();
  if (!can(session.role, "view_insights")) return <NoAccess what="insights" />;

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Guideline health"
        description="Which rules are clear, which keep getting dismissed, and where reviews slow down."
      />
      <EmptyState icon={ChartNoAxesColumn} title="Not enough reviews yet">
        Guideline Clarity Scores appear once a rule has at least 10 findings.
      </EmptyState>
    </>
  );
}
