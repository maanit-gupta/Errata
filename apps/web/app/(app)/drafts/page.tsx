import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Drafts" };

export default async function DraftsPage() {
  const session = await requireSession();
  if (!can(session.role, "submit_content")) redirect("/review");

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Drafts"
        description="Write or upload a draft, say what it's for, and get cited findings before anyone reviews it."
      />
      <EmptyState icon={FileText} title="No drafts yet">
        Your drafts will appear here with their state and open findings.
      </EmptyState>
    </>
  );
}
