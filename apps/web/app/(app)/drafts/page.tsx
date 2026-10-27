import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/brand/page-header";
import { PixelGlyph } from "@/components/brand/pixel-glyphs";
import { SeverityBadge } from "@/components/brand/severity-badge";
import { DraftsTable, type DraftRow } from "@/components/drafts/drafts-table";
import { requireSession } from "@/lib/auth/session";
import { CHANNELS } from "@/lib/drafts/intent";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/workflow/permissions";

export const metadata = { title: "Drafts" };

const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;

const newDraft = (
  <Link
    href="/drafts/new"
    className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
  >
    <Plus aria-hidden className="size-4" /> New draft
  </Link>
);

/** Onboarding (DESIGN.md §6.2) when the user has no content. */
function Onboarding() {
  return (
    <section
      aria-labelledby="onboard-h"
      className="border-line bg-elevated grid gap-8 rounded-md border p-8 lg:grid-cols-2"
    >
      <div className="space-y-4">
        <PixelGlyph name="shield-check" size={48} />
        <h2 id="onboard-h" className="text-2xl">
          Check your first draft
        </h2>
        <p className="text-fg-muted max-w-md">
          Paste a caption, upload a DOCX, image or PDF, say who it&apos;s for, and get findings that
          cite your brand rules.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {newDraft}
          <Link
            href="/#how-it-works"
            className="text-accent-soft text-sm underline-offset-4 hover:underline"
          >
            How citations work →
          </Link>
        </div>
      </div>
      <div
        aria-hidden
        className="border-line bg-canvas space-y-2 self-center rounded-md border p-4"
      >
        <p className="flex items-center gap-2">
          <SeverityBadge severity="blocker" />
          <span className="mono-id text-accent-soft">CL-03</span>
          <span className="mono-label text-fg-faint">CLAIMS</span>
        </p>
        <p className="font-mono text-[0.8125rem]">“14.2% assured annual returns”</p>
        <p className="text-fg-muted text-sm">
          Market-linked returns can&apos;t be promised. Cite the historical CAGR with its
          disclaimer.
        </p>
        <p className="mono-label text-success">✓ cited · intent verified · 0.91</p>
      </div>
    </section>
  );
}

export default async function DraftsPage() {
  const session = await requireSession();
  if (!can(session.role, "submit_content")) redirect("/review");

  const supabase = await createClient();
  const { data: contents, error } = await supabase
    .from("contents")
    .select(
      "id, title, channel, state, route_to, format, risk_score, current_version_id, updated_at, campaigns(name)",
    )
    .eq("owner_id", session.userId)
    .neq("state", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Couldn't load your drafts: ${error.message}`);

  const versionIds = (contents ?? [])
    .map((c) => c.current_version_id)
    .filter((v): v is string => !!v);
  const { data: open } = versionIds.length
    ? await supabase
        .from("findings")
        .select("version_id, severity")
        .in("version_id", versionIds)
        .eq("status", "open")
    : { data: [] as { version_id: string; severity: string }[] };
  const counts = new Map<string, DraftRow["open"]>();
  for (const f of open ?? []) {
    const c = counts.get(f.version_id) ?? { blocker: 0, warning: 0, suggestion: 0 };
    c[f.severity as keyof DraftRow["open"]] += 1;
    counts.set(f.version_id, c);
  }

  const rows: DraftRow[] = (contents ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    campaign: c.campaigns?.name ?? null,
    channel: channelLabel(c.channel),
    state: c.state,
    routeTo: c.route_to,
    format: c.format,
    risk: c.risk_score,
    open: (c.current_version_id && counts.get(c.current_version_id)) || {
      blocker: 0,
      warning: 0,
      suggestion: 0,
    },
    updatedAt: c.updated_at,
  }));

  return (
    <>
      <PageHeader title="Drafts" actions={rows.length ? newDraft : null} />
      {rows.length ? <DraftsTable rows={rows} /> : <Onboarding />}
    </>
  );
}
