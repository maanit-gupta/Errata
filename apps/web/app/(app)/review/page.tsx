import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const session = await requireSession();
  if (!can(session.role, "approve_or_request_changes")) return <NoAccess what="the review queue" />;

  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title="Review queue"
        description="Content waiting for a decision, highest risk first."
      />
      <EmptyState icon={Inbox} title="Nothing to review">
        Drafts that pass the AI check land here, sorted by risk score.
      </EmptyState>
    </>
  );
}
