import Link from "next/link";
import { redirect } from "next/navigation";
import { NewDraftForm } from "@/components/drafts/new-draft-form";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { StateBadge } from "@/components/brand/state-badge";
import { requireSession } from "@/lib/auth/session";
import { CHANNELS } from "@/lib/drafts/intent";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Drafts" };

const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;

export default async function DraftsPage() {
  const session = await requireSession();
  if (!can(session.role, "submit_content")) redirect("/review");

  const supabase = await createClient();
  const [{ data: contents }, { data: campaigns }] = await Promise.all([
    supabase
      .from("contents")
      .select("id, title, channel, state, updated_at, campaigns(name)")
      .eq("owner_id", session.userId)
      .neq("state", "archived")
      .order("updated_at", { ascending: false }),
    supabase
      .from("campaigns")
      .select("id, name, status")
      .eq("org_id", session.orgId)
      .order("starts_on", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Drafts"
        description="Write or upload a draft, say what it's for, and get cited findings before anyone reviews it."
      />
      <NewDraftForm campaigns={campaigns ?? []} />
      <div className="mt-8">
        {contents?.length ? (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your drafts</caption>
              <thead className="border-border bg-muted/60 border-b">
                <tr>
                  {["Title", "Campaign", "Channel", "State", "Updated"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contents.map((c) => (
                  <tr key={c.id} className="border-border border-b last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      <Link href={`/drafts/${c.id}`} className="underline-offset-4 hover:underline">
                        {c.title}
                      </Link>
                    </th>
                    <td className="px-4 py-3">{c.campaigns?.name}</td>
                    <td className="px-4 py-3">{channelLabel(c.channel)}</td>
                    <td className="px-4 py-3">
                      <StateBadge state={c.state} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {new Date(c.updated_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState glyph="shield-check" title="No drafts yet">
            Create a draft above. Your drafts will appear here with their state.
          </EmptyState>
        )}
      </div>
    </>
  );
}
