import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GuideUpload } from "./guide-upload";
import { RealtimeRefresh } from "./realtime-refresh";

const STATUS_TEXT = {
  uploaded: "Queued",
  parsing: "Extracting rules…",
  drafted: "Drafts ready",
  failed: "Failed",
} as const;

export async function GuidesTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [{ data: guides }, { data: drafts }] = await Promise.all([
    supabase
      .from("brand_guides")
      .select("id, title, source_kind, status, error, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("rule_cards").select("guide_id").eq("org_id", orgId).eq("status", "draft"),
  ]);
  const draftCounts = new Map<string, number>();
  for (const d of drafts ?? [])
    if (d.guide_id) draftCounts.set(d.guide_id, (draftCounts.get(d.guide_id) ?? 0) + 1);

  return (
    <div className="space-y-8">
      <RealtimeRefresh
        orgId={orgId}
        tables={["brand_guides", "rule_cards"]}
        pollMs={
          guides?.some((g) => g.status === "uploaded" || g.status === "parsing")
            ? 10_000
            : undefined
        }
      />
      <section
        aria-labelledby="upload-h"
        className="border-border rounded-lg border border-dashed p-4"
      >
        <h2 id="upload-h" className="font-heading text-lg">
          Add a brand guide
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          BrandLens drafts one rule card per guideline. Nothing is used in checks until you approve
          it.
        </p>
        <GuideUpload />
      </section>
      <section aria-labelledby="guides-h">
        <h2 id="guides-h" className="font-heading mb-3 text-lg">
          Guides
        </h2>
        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Uploaded brand guides and their extraction status</caption>
            <thead className="border-border bg-muted/60 border-b">
              <tr>
                {["Guide", "Source", "Added", "Status", "Drafts to review"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(guides ?? []).map((g) => (
                <tr key={g.id} className="border-border border-b last:border-0">
                  <th scope="row" className="px-3 py-2 font-medium">
                    {g.title}
                  </th>
                  <td className="px-3 py-2 uppercase">{g.source_kind}</td>
                  <td className="px-3 py-2">
                    {new Date(g.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2" aria-live="polite">
                    {STATUS_TEXT[g.status]}
                    {g.status === "failed" && g.error ? (
                      <span className="text-accent-text ml-1 font-mono text-xs">({g.error})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {draftCounts.get(g.id) ? (
                      <Link
                        href="/vault?tab=rules&status=draft"
                        className="font-medium underline underline-offset-4"
                      >
                        {draftCounts.get(g.id)} draft{draftCounts.get(g.id) === 1 ? "" : "s"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {guides?.length ? null : (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-6 text-center">
                    No guides yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
