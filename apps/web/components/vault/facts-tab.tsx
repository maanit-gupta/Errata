import { createClient } from "@/lib/supabase/server";
import { CsvImport } from "./csv-import";
import { FactsTable } from "./facts-table";

export async function FactsTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [{ data: facts }, { data: campaigns }] = await Promise.all([
    supabase
      .from("facts")
      .select(
        "id, code, kind, statement, value, required_disclaimer, valid_until, never_send, campaigns(name)",
      )
      .eq("org_id", orgId)
      .order("code"),
    supabase.from("campaigns").select("id, name").eq("org_id", orgId).order("name"),
  ]);
  return (
    <>
      <CsvImport kind="facts" campaigns={campaigns ?? []} />
      <FactsTable
        now={new Date().toISOString()}
        facts={(facts ?? []).map((f) => ({ ...f, campaign: f.campaigns?.name ?? null }))}
      />
    </>
  );
}
