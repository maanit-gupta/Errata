import { IdCode } from "@/components/brand/id-badge";
import { createClient } from "@/lib/supabase/server";
import { CsvImport } from "./csv-import";

export async function GlossaryTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: terms } = await supabase
    .from("glossary_terms")
    .select("id, code, preferred, variants, banned, case_sensitive, note")
    .eq("org_id", orgId)
    .order("code");
  return (
    <>
      <CsvImport kind="glossary" />
      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Glossary terms</caption>
          <thead className="border-border bg-muted/60 border-b">
            <tr>
              {["Code", "Preferred", "Flag these variants", "Banned", "Case-sensitive", "Note"].map(
                (h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(terms ?? []).map((t) => (
              <tr key={t.id} className="border-border border-b align-top last:border-0">
                <th scope="row" className="px-3 py-2">
                  <IdCode code={t.code} />
                </th>
                <td className="px-3 py-2 font-medium">{t.preferred}</td>
                <td className="px-3 py-2">{t.variants.join(", ") || "—"}</td>
                <td className="px-3 py-2">{t.banned ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{t.case_sensitive ? "Yes" : "No"}</td>
                <td className="text-muted-foreground px-3 py-2">{t.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
