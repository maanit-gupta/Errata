import { redirect } from "next/navigation";
import { PageHeader } from "@/components/brand/page-header";
import { NewDraftForm } from "@/components/drafts/new-draft-form";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "New draft" };

export default async function NewDraftPage() {
  const session = await requireSession();
  if (!can(session.role, "submit_content")) redirect("/review");
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status")
    .eq("org_id", session.orgId)
    .order("starts_on", { ascending: false });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Drafts"
        title="New draft"
        description="Name it and pick its campaign. Next you'll write or upload it and say what it's for."
      />
      <NewDraftForm campaigns={campaigns ?? []} />
    </div>
  );
}
