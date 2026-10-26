import { createClient } from "@/lib/supabase/server";
import { CampaignForm } from "./campaign-form";

export async function CampaignsTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, starts_on, ends_on, status")
    .eq("org_id", orgId)
    .order("starts_on", { ascending: false });
  return (
    <div className="space-y-8">
      <section
        aria-labelledby="new-campaign"
        className="border-border rounded-lg border border-dashed p-4"
      >
        <h2 id="new-campaign" className="font-heading mb-3 text-lg">
          New campaign
        </h2>
        <CampaignForm />
      </section>
      <section aria-labelledby="campaign-list">
        <h2 id="campaign-list" className="font-heading mb-3 text-lg">
          Campaigns
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Facts and content carry their campaign, which is how BrandLens catches details copied from
          another campaign.
        </p>
        <ul className="divide-border border-border bg-card divide-y rounded-lg border">
          {(campaigns ?? []).map((c) => (
            <li key={c.id} className="p-4">
              <CampaignForm campaign={c} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
