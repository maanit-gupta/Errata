import { EmptyState } from "@/components/brand/empty-state";
import { IdCode } from "@/components/brand/id-badge";
import { createClient } from "@/lib/supabase/server";
import { CsvImport } from "./csv-import";

/** Glossary (DESIGN.md §6.6): preferred in mono, variants as chips, banned as a blocker chip. */
export async function GlossaryTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: terms, error } = await supabase
    .from("glossary_terms")
    .select("id, code, preferred, variants, banned, case_sensitive, note")
    .eq("org_id", orgId)
    .order("code");
  if (error) throw new Error(`Couldn't load the glossary: ${error.message}`);
  return (
    <>
      <CsvImport kind="glossary" />
      {terms?.length ? (
        <div className="border-outline overflow-x-auto rounded-lg border-2">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Glossary terms</caption>
            <thead className="bg-elevated">
              <tr className="border-line border-b">
                {[
                  "Code",
                  "Preferred",
                  "Flag these variants",
                  "Banned",
                  "Case-sensitive",
                  "Note",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="mono-label text-fg-faint h-10 px-3 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr
                  key={t.id}
                  className="border-line hover:bg-hover border-b align-middle last:border-0"
                >
                  <th scope="row" className="px-3 py-2.5 font-normal">
                    <IdCode code={t.code} />
                  </th>
                  <td className="mono-id px-3 py-2.5">{t.preferred}</td>
                  <td className="px-3 py-2.5">
                    {t.variants.length ? (
                      <ul className="flex flex-wrap gap-1">
                        {t.variants.map((v: string) => (
                          <li
                            key={v}
                            className="bg-hover rounded-sm px-1.5 py-0.5 font-mono text-xs"
                          >
                            {v}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-fg-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {t.banned ? (
                      <span className="mono-label bg-blocker text-blocker-fg rounded-sm px-1.5 py-0.5">
                        BANNED
                      </span>
                    ) : (
                      <span className="text-fg-faint text-xs">No</span>
                    )}
                  </td>
                  <td className="text-fg-muted px-3 py-2.5 text-xs">
                    {t.case_sensitive ? "Yes" : "No"}
                  </td>
                  <td className="text-fg-muted px-3 py-2.5">{t.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState glyph="rule-card" title="No glossary terms yet">
          Import a glossary CSV: preferred spellings, variants to flag, and banned terms.
        </EmptyState>
      )}
    </>
  );
}
