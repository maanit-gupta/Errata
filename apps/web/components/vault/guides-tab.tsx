import Link from "next/link";
import { RuleCardSpot } from "@/components/illustrations";
import { createClient } from "@/lib/supabase/server";
import { GuideUpload } from "./guide-upload";
import { RealtimeRefresh } from "./realtime-refresh";

function GuideStatus({
  status,
  drafted,
}: {
  status: "uploaded" | "parsing" | "drafted" | "failed";
  drafted: number;
}) {
  const map = {
    uploaded: { cls: "border-line-strong text-fg-muted", text: "UPLOADED" },
    parsing: { cls: "border-accent text-fg", text: "⟳ PARSING" },
    drafted: {
      cls: "bg-success-bg text-success border-transparent",
      text: `✓ DRAFTED ${drafted} card${drafted === 1 ? "" : "s"}`,
    },
    failed: { cls: "border-danger text-danger", text: "FAILED" },
  }[status];
  return (
    <span className={`mono-label inline-flex h-5 items-center rounded-sm border px-1.5 ${map.cls}`}>
      {map.text}
    </span>
  );
}

export async function GuidesTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [{ data: guides, error }, { data: drafts }, { data: cards }] = await Promise.all([
    supabase
      .from("brand_guides")
      .select("id, title, source_kind, status, error, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("rule_cards").select("guide_id").eq("org_id", orgId).eq("status", "draft"),
    supabase.from("rule_cards").select("guide_id").eq("org_id", orgId),
  ]);
  if (error) throw new Error(`Couldn't load guides: ${error.message}`);
  const cardCounts = new Map<string, number>();
  for (const c of cards ?? [])
    if (c.guide_id) cardCounts.set(c.guide_id, (cardCounts.get(c.guide_id) ?? 0) + 1);
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
        className="border-control flex gap-4 rounded-sm border-2 border-dashed p-5"
      >
        <RuleCardSpot className="w-20" />
        <div className="min-w-0 flex-1">
          <h2 id="upload-h" className="text-lg">
            Add a brand guide
          </h2>
          <p className="text-fg-muted mb-4 text-sm">
            BrandLens drafts one rule card per guideline. Nothing is used in checks until you
            approve it.
          </p>
          <GuideUpload />
        </div>
      </section>
      <section aria-labelledby="guides-h">
        <h2 id="guides-h" className="mono-label text-fg-faint mb-2">
          Guides
        </h2>
        <div className="border-outline overflow-x-auto rounded-lg border-2">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Uploaded brand guides and their extraction status</caption>
            <thead className="bg-elevated border-line border-b">
              <tr>
                {["Guide", "Source", "Added", "Status", "Drafts to review"].map((h) => (
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
              {(guides ?? []).map((g) => (
                <tr key={g.id} className="border-line hover:bg-hover border-b last:border-0">
                  <th scope="row" className="px-3 py-2 font-medium">
                    {g.title}
                  </th>
                  <td className="mono-label text-fg-muted px-3 py-2">{g.source_kind}</td>
                  <td className="mono-id text-fg-muted px-3 py-2">
                    {new Date(g.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2" aria-live="polite">
                    <GuideStatus status={g.status} drafted={cardCounts.get(g.id) ?? 0} />
                    {g.status === "failed" && g.error ? (
                      <span className="text-danger ml-2 font-mono text-xs">{g.error}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {draftCounts.get(g.id) ? (
                      <Link
                        href="/vault?tab=rules&status=draft"
                        className="text-accent-soft font-semibold underline underline-offset-4"
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
                  <td colSpan={5} className="text-fg-muted px-3 py-8 text-center">
                    No guides yet. Upload one above to draft rule cards.
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
