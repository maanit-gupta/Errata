import { createClient } from "@/lib/supabase/server";
import { CampaignsView } from "./campaigns-view";

export async function CampaignsTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [{ data: campaigns, error }, { data: facts }] = await Promise.all([
    supabase.from("campaigns").select("id, name, starts_on, ends_on, status").eq("org_id", orgId),
    supabase.from("facts").select("campaign_id").eq("org_id", orgId),
  ]);
  if (error) throw new Error(`Couldn't load campaigns: ${error.message}`);
  const counts = new Map<string, number>();
  for (const f of facts ?? [])
    if (f.campaign_id) counts.set(f.campaign_id, (counts.get(f.campaign_id) ?? 0) + 1);
  return (
    <CampaignsView
      campaigns={(campaigns ?? []).map((c) => ({ ...c, facts: counts.get(c.id) ?? 0 }))}
    />
  );
}
