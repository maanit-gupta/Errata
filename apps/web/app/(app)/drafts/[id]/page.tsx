import { notFound } from "next/navigation";
import type { Citation, FindingView } from "@/components/drafts/finding-card";
import { DraftWorkspace } from "@/components/drafts/draft-workspace";
import { signedPages } from "@/lib/drafts/pages";
import { spanBox, spanPage, spanTarget } from "@/lib/drafts/span";
import { SetCrumb } from "@/components/shell/crumbs";
import { RealtimeRefresh } from "@/components/vault/realtime-refresh";
import { requireSession } from "@/lib/auth/session";
import type { Intent } from "@/lib/drafts/intent";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Draft" };

export default async function DraftPage({ params }: PageProps<"/drafts/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("id, title, channel, state, owner_id, campaign_id, current_version_id, campaigns(name)")
    .eq("id", id)
    .maybeSingle();
  if (!content) notFound();

  const [{ data: campaigns }, { data: version }] = await Promise.all([
    supabase.from("campaigns").select("id, name, status").eq("org_id", session.orgId),
    content.current_version_id
      ? supabase
          .from("versions")
          .select("id, n, body, intent, format, storage_path")
          .eq("id", content.current_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // The latest run for this content (the current version, or the one before a resubmit lands).
  const { data: run } = version
    ? await supabase
        .from("review_runs")
        .select(
          "id, status, degraded, error_code, version_id, pages, provider, model_version, prompt_version, timings, versions!inner(content_id)",
        )
        .eq("versions.content_id", content.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: rows } = run
    ? await supabase
        .from("findings")
        .select(
          "id, dimension, severity, confidence, source, quote, span, explanation, rewrite, status, dismiss_reason, rule_id, fact_id, wcag_ref, model_version, prompt_version, resolved_at",
        )
        .eq("run_id", run.id)
        .neq("status", "superseded")
    : { data: [] };

  // Citations: agencies only ever see rule summaries (SPEC §2 ¹).
  const ruleIds = [...new Set((rows ?? []).map((r) => r.rule_id).filter((x): x is string => !!x))];
  const factIds = [...new Set((rows ?? []).map((r) => r.fact_id).filter((x): x is string => !!x))];
  const isAgency = session.role === "agency_creator";
  type RuleSrc = {
    id: string | null;
    code: string | null;
    title: string | null;
    summary: string | null;
    body?: string | null;
    version?: number | null;
    source_page?: number | null;
    dimension?: string | null;
    never_send?: boolean | null;
  };
  const [{ data: rules }, { data: facts }] = await Promise.all([
    ruleIds.length
      ? isAgency
        ? supabase.from("rule_cards_public").select("id, code, title, summary").in("id", ruleIds)
        : supabase
            .from("rule_cards")
            .select("id, code, title, summary, body, version, source_page, dimension, never_send")
            .in("id", ruleIds)
      : Promise.resolve({ data: [] as RuleSrc[] }),
    factIds.length
      ? supabase
          .from("facts")
          .select("id, code, statement, never_send, campaigns(name)")
          .in("id", factIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            code: string;
            statement: string;
            never_send: boolean;
            campaigns: { name: string } | null;
          }[],
        }),
  ]);
  const vaultHref = session.role === "brand_admin";
  const ruleById = new Map(((rules ?? []) as RuleSrc[]).map((r) => [r.id, r]));
  const factById = new Map((facts ?? []).map((f) => [f.id, f]));

  const findings: FindingView[] = (rows ?? []).map((r) => {
    const citations: Citation[] = [];
    const rule = r.rule_id ? ruleById.get(r.rule_id) : undefined;
    if (rule?.code)
      citations.push({
        code: rule.code,
        kind: "rule",
        title: rule.title ?? undefined,
        text: rule.summary ?? undefined,
        source: {
          title: rule.title ?? undefined,
          summary: rule.summary ?? undefined,
          body: rule.body ?? undefined,
          version: rule.version ?? undefined,
          sourcePage: rule.source_page,
          dimension: rule.dimension ?? undefined,
          neverSend: rule.never_send ?? undefined,
          summaryView: isAgency,
          href: vaultHref && rule.id ? `/vault?tab=rules&card=${rule.id}` : undefined,
        },
      });
    const fact = r.fact_id ? factById.get(r.fact_id) : undefined;
    if (fact)
      citations.push({
        code: fact.code,
        kind: "fact",
        text: fact.statement,
        source: {
          title: fact.campaigns?.name ? `Campaign: ${fact.campaigns.name}` : "Org-wide fact",
          summary: fact.statement,
          neverSend: fact.never_send,
          href: vaultHref ? "/vault?tab=facts" : undefined,
        },
      });
    if (r.wcag_ref)
      citations.push({
        code: `WCAG ${r.wcag_ref}`,
        kind: "wcag",
        title: "Web Content Accessibility Guidelines 2.2",
      });
    const span = r.span as { start?: number; end?: number } | null;
    return {
      ...r,
      span: { start: span?.start ?? 0, end: span?.end ?? 0 },
      target: spanTarget(r.span),
      box: spanBox(r.span),
      page: spanPage(r.span),
      citations,
    } as FindingView;
  });

  // Image versions render from a short-lived signed URL (private bucket, SPEC §3).
  const imageUrl =
    version?.format === "image" && version.storage_path
      ? ((await supabase.storage.from("drafts").createSignedUrl(version.storage_path, 3600)).data
          ?.signedUrl ?? null)
      : null;

  // PDF versions: the page renders the worker made for this version's run (P12).
  const pdfPages =
    version?.format === "pdf" && run && run.version_id === version.id
      ? await signedPages(supabase, run.pages)
      : [];

  const isOwner = content.owner_id === session.userId || session.role === "brand_admin";
  const canEdit = isOwner && (content.state === "draft" || content.state === "needs_revision");

  return (
    <>
      <RealtimeRefresh orgId={session.orgId} tables={["review_runs", "findings", "contents"]} />
      <SetCrumb label={version ? `${content.title} / v${version.n}` : content.title} />
      <DraftWorkspace
        content={{
          id: content.id,
          title: content.title,
          state: content.state,
          channel: content.channel,
          campaignId: content.campaign_id,
        }}
        campaigns={campaigns ?? []}
        version={version ? { ...version, intent: (version.intent ?? {}) as Partial<Intent> } : null}
        run={
          run
            ? {
                id: run.id,
                status: run.status,
                degraded: run.degraded,
                error_code: run.error_code,
                provider: run.provider,
                model: run.model_version,
                prompt: run.prompt_version,
                timings: (run.timings ?? null) as Record<string, unknown> | null,
              }
            : null
        }
        findings={findings}
        imageUrl={imageUrl}
        pdfPages={pdfPages}
        canEdit={canEdit}
        canAct={isOwner}
        summaryView={isAgency}
      />
    </>
  );
}
