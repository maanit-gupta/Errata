import Link from "next/link";
import { notFound } from "next/navigation";
import type { Citation, FindingView } from "@/components/drafts/finding-card";
import { ReviewFindings } from "@/components/review/review-findings";
import { ReviewTabs } from "@/components/review/review-tabs";
import { RiskMeter } from "@/components/brand/risk-meter";
import { SetCrumb } from "@/components/shell/crumbs";
import { spanTarget } from "@/lib/drafts/span";
import { ImageFindings } from "@/components/drafts/image-findings";
import { PdfFindings } from "@/components/drafts/pdf-findings";
import { Comments, type CommentView } from "@/components/review/comments";
import { DecisionBar } from "@/components/review/decision-bar";
import { HighlightedText } from "@/components/review/highlighted-text";
import { VersionDiff } from "@/components/review/version-diff";
import { StateBadge } from "@/components/brand/state-badge";
import { VersionSwitcher } from "@/components/brand/version-switcher";
import { RealtimeRefresh } from "@/components/vault/realtime-refresh";
import { requireSession } from "@/lib/auth/session";
import { signedPages } from "@/lib/drafts/pages";
import { spanBox, spanPage } from "@/lib/drafts/span";
import { createClient } from "@/lib/supabase/server";
import { can as canDo } from "@/lib/workflow/permissions";
import { SIGNED_URL_TTL_S } from "@/lib/limits";

export const metadata = { title: "Review" };

const ROUTE_LABEL: Record<string, string> = {
  manager: "Manager",
  legal: "Legal",
  a11y: "Accessibility",
  brand: "Brand",
};
const SEVERITY_ORDER: Record<string, number> = { blocker: 0, warning: 1, suggestion: 2 };

type Finding = {
  id: string;
  dimension: string;
  severity: "blocker" | "warning" | "suggestion";
  status: string;
  quote: string;
  span: { start: number; end: number };
  explanation: string;
  source: string;
  confidence: number;
  resolved_by: string | null;
  dismiss_reason: string | null;
  codes: string;
};

function routingReason(route: string | null, findings: Finding[]): string {
  const pick = (pred: (f: Finding) => boolean) => findings.find(pred);
  if (route === "legal") {
    const f = pick(
      (x) => x.dimension === "claims" && (x.status === "open" || x.status === "routed"),
    );
    return f
      ? `${f.status === "routed" ? "Routed" : "Open"} ${f.codes} claim → Legal`
      : "Claims review → Legal";
  }
  if (route === "a11y") {
    const f = pick((x) => x.dimension === "access" && x.status === "open");
    return f ? `Open ${f.codes} accessibility issue → Accessibility` : "Accessibility review";
  }
  if (route === "brand") {
    const f = pick((x) => x.dimension === "visual" && x.status === "open");
    return f ? `Open ${f.codes} visual warning → Brand` : "Brand review";
  }
  return "No specialist issues → Manager";
}

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

export default async function ReviewContentPage({
  params,
  searchParams,
}: PageProps<"/review/[contentId]">) {
  const { contentId } = await params;
  const { v } = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select(
      "id, title, state, route_to, risk_score, owner_id, org_id, current_version_id, campaigns(name)",
    )
    .eq("id", contentId)
    .maybeSingle();
  if (!content) notFound();

  const { data: versions } = await supabase
    .from("versions")
    .select("id, n, body, format, storage_path, intent, created_at")
    .eq("content_id", contentId)
    .order("n", { ascending: false });
  const latest = versions?.find((x) => x.id === content.current_version_id) ?? versions?.[0];
  // `?v=N` views an older version read-only; decisions always apply to the latest one.
  const current = (typeof v === "string" && versions?.find((x) => String(x.n) === v)) || latest;
  const viewingOld = !!current && !!latest && current.id !== latest.id;
  const previous = versions?.find((x) => current && x.n === current.n - 1);
  const versionIds = (versions ?? []).map((v) => v.id);

  const [{ data: profiles }, { data: findingRows }, { data: decisions }, { data: commentRows }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name"),
      versionIds.length
        ? supabase
            .from("findings")
            .select(
              "id, version_id, run_id, dimension, severity, status, quote, span, explanation, source, confidence, resolved_by, resolved_at, dismiss_reason, rule_id, fact_id, wcag_ref, rewrite, model_version, prompt_version, created_at",
            )
            .in("version_id", versionIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      versionIds.length
        ? supabase
            .from("decisions")
            .select("id, version_id, actor_id, action, reason, finding_id, created_at")
            .in("version_id", versionIds)
        : Promise.resolve({ data: [] }),
      current
        ? supabase
            .from("comments")
            .select("id, author_id, body, anchor, created_at")
            .eq("version_id", current.id)
            .order("created_at")
        : Promise.resolve({ data: [] }),
    ]);
  const name = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));

  const ruleIds = [
    ...new Set((findingRows ?? []).map((f) => f.rule_id).filter((x): x is string => !!x)),
  ];
  const factIds = [
    ...new Set((findingRows ?? []).map((f) => f.fact_id).filter((x): x is string => !!x)),
  ];
  const [{ data: rules }, { data: facts }] = await Promise.all([
    ruleIds.length
      ? session.role === "agency_creator"
        ? supabase.from("rule_cards_public").select("id, code, title, summary").in("id", ruleIds)
        : supabase
            .from("rule_cards")
            .select("id, code, title, summary, body, version, source_page, dimension, never_send")
            .in("id", ruleIds)
      : Promise.resolve({ data: [] as RuleSrc[] }),
    factIds.length
      ? supabase.from("facts").select("id, code, statement, never_send").in("id", factIds)
      : Promise.resolve({
          data: [] as { id: string; code: string; statement: string; never_send: boolean }[],
        }),
  ]);
  const ruleById = new Map(((rules ?? []) as RuleSrc[]).map((r) => [r.id ?? "", r]));
  const factById = new Map((facts ?? []).map((f) => [f.id, f]));
  const isAgency = session.role === "agency_creator";
  const admin = session.role === "brand_admin";
  const citationsFor = (f: NonNullable<typeof findingRows>[number]): Citation[] => {
    const out: Citation[] = [];
    const r = f.rule_id ? ruleById.get(f.rule_id) : undefined;
    if (r?.code)
      out.push({
        code: r.code,
        kind: "rule",
        title: r.title ?? undefined,
        text: r.summary ?? undefined,
        source: {
          title: r.title ?? undefined,
          summary: r.summary ?? undefined,
          body: r.body ?? undefined,
          version: r.version ?? undefined,
          sourcePage: r.source_page,
          dimension: r.dimension ?? undefined,
          neverSend: r.never_send ?? undefined,
          summaryView: isAgency,
          href: admin && r.id ? `/vault?tab=rules&card=${r.id}` : undefined,
        },
      });
    const fa = f.fact_id ? factById.get(f.fact_id) : undefined;
    if (fa)
      out.push({
        code: fa.code,
        kind: "fact",
        text: fa.statement,
        source: {
          summary: fa.statement,
          neverSend: fa.never_send,
          href: admin ? "/vault?tab=facts" : undefined,
        },
      });
    if (f.wcag_ref) out.push({ code: `WCAG ${f.wcag_ref}`, kind: "wcag" });
    return out;
  };
  const code = new Map<string, string>([
    ...(rules ?? []).map((r) => [r.id ?? "", r.code ?? ""] as [string, string]),
    ...(facts ?? []).map((f) => [f.id, f.code] as [string, string]),
  ]);
  const toFinding = (f: NonNullable<typeof findingRows>[number]): Finding => ({
    ...f,
    span: f.span as { start: number; end: number },
    codes: [
      f.rule_id && code.get(f.rule_id),
      f.fact_id && code.get(f.fact_id),
      f.wcag_ref && `WCAG ${f.wcag_ref}`,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  // Current version: findings from its latest run.
  const currentRows = (findingRows ?? []).filter((f) => f.version_id === current?.id);
  const latestRun = currentRows[0]?.run_id;
  const findings = currentRows
    .filter((f) => f.run_id === latestRun)
    .map(toFinding)
    .filter((f) => f.codes)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.span.start - b.span.start,
    );
  const views: FindingView[] = currentRows
    .filter((f) => f.run_id === latestRun)
    .map((f) => ({
      id: f.id,
      dimension: f.dimension,
      severity: f.severity,
      confidence: f.confidence,
      source: f.source,
      quote: f.quote,
      span: f.span as { start: number; end: number },
      target: spanTarget(f.span),
      box: spanBox(f.span),
      page: spanPage(f.span),
      explanation: f.explanation,
      rewrite: f.rewrite,
      status: f.status,
      dismiss_reason: f.dismiss_reason,
      model_version: f.model_version,
      prompt_version: f.prompt_version,
      resolved_at: f.resolved_at,
      resolvedBy: f.resolved_by ? (name.get(f.resolved_by) ?? "someone") : null,
      citations: citationsFor(f),
    }))
    .filter((f) => f.citations.length)
    .sort(
      (a, b) =>
        Number(a.status !== "open") - Number(b.status !== "open") ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.span.start - b.span.start,
    );
  // Image versions render from a short-lived signed URL (private bucket, SPEC §3).
  const imageUrl =
    current?.format === "image" && current.storage_path
      ? ((
          await supabase.storage
            .from("drafts")
            .createSignedUrl(current.storage_path, SIGNED_URL_TTL_S)
        ).data?.signedUrl ?? null)
      : null;
  const altText = (current?.intent as { alt_text?: string } | null)?.alt_text;
  const markers = findings.flatMap((f) => {
    const box = spanBox(f.span);
    return box && (f.status === "open" || f.status === "routed")
      ? [{ id: f.id, severity: f.severity, codes: f.codes, label: f.quote, box }]
      : [];
  });
  // PDF versions: the page renders of the run these findings came from (P12).
  const { data: pdfRun } =
    current?.format === "pdf" && latestRun
      ? await supabase.from("review_runs").select("pages").eq("id", latestRun).maybeSingle()
      : { data: null };
  const pdfPages = pdfRun ? await signedPages(supabase, pdfRun.pages) : [];
  const pageOf = new Map(findings.map((f) => [f.id, spanPage(f.span)]));
  const pdfMarkers = markers.flatMap((m) => {
    const page = pageOf.get(m.id);
    return page ? [{ ...m, page }] : [];
  });

  const resolvedByChange = (findingRows ?? [])
    .filter(
      (f) =>
        f.version_id === previous?.id && ["accepted", "edited", "superseded"].includes(f.status),
    )
    .map(toFinding)
    .map((f) => ({ id: f.id, codes: f.codes, quote: f.quote, status: f.status }));

  const overridden = new Set(
    (decisions ?? []).filter((d) => d.action === "override").map((d) => d.finding_id),
  );
  const openWarnings = findings
    .filter((f) => f.severity === "warning" && f.status === "open" && !overridden.has(f.id))
    .map((f) => ({ id: f.id, label: `${f.codes} “${f.quote}”` }));

  const isOwner = content.owner_id === session.userId;
  const role = session.role;
  const can = {
    review: content.state === "in_review" && (role === "manager" || role === "brand_admin"),
    specialist:
      content.state === "specialist_review" &&
      ((role === "specialist" && session.specialistKind === content.route_to) ||
        (role === "brand_admin" && (content.route_to === "a11y" || content.route_to === "brand"))),
    markReady:
      content.state === "approved" && (role === "manager" || role === "brand_admin" || isOwner),
    archive: (role === "manager" || role === "brand_admin") && content.state !== "archived",
  };

  const { data: audit } = canDo(role, "view_audit_log")
    ? await supabase
        .from("audit_events")
        .select("id, actor_id, event, at")
        .eq("org_id", content.org_id)
        .order("at")
    : { data: null };
  const trail = (audit ?? []).filter((a) => {
    const e = a.event as Record<string, unknown>;
    return (
      e.content_id === content.id ||
      (typeof e.version_id === "string" && versionIds.includes(e.version_id))
    );
  });

  const comments: CommentView[] = (commentRows ?? []).map((c) => {
    const anchor = c.anchor as { type?: string; finding_id?: string } | null;
    const f = anchor?.finding_id ? findings.find((x) => x.id === anchor.finding_id) : undefined;
    return {
      id: c.id,
      author: name.get(c.author_id) ?? "Someone",
      body: c.body,
      at: c.created_at,
      findingLabel: f ? f.codes : null,
    };
  });

  const openCount = findings.filter((f) => f.status === "open").length;
  const auditPanel = audit ? (
    <ol id="audit" className="border-line relative space-y-0 border-l pl-4">
      {trail.map((a) => {
        const e = a.event as Record<string, string | null>;
        return (
          <li key={a.id} className="relative pb-4">
            <span
              aria-hidden
              className="bg-line-strong absolute top-1.5 -left-[1.3rem] size-2 rounded-full"
            />
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-fg">
                {a.actor_id ? (name.get(a.actor_id) ?? "Someone") : "BrandLens"}
              </span>
              <span className="mono-id text-accent-soft">
                {e.type === "transition"
                  ? `${e.from} → ${e.to}`
                  : e.type === "finding_status"
                    ? `finding ${e.from} → ${e.to}`
                    : String(e.type)}
              </span>
            </p>
            <time className="mono-id text-fg-faint block text-xs" dateTime={a.at}>
              {new Date(a.at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "medium",
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </time>
            {e.reason ? <p className="text-fg-muted mt-1 text-sm">“{e.reason}”</p> : null}
          </li>
        );
      })}
      {trail.length ? null : <li className="text-fg-muted text-sm">No events yet.</li>}
    </ol>
  ) : null;

  const panels = [
    {
      value: "findings",
      label: "Findings",
      count: openCount,
      content: <ReviewFindings findings={views} summaryView={isAgency} />,
    },
    ...(previous?.body && current?.body
      ? [
          {
            value: "diff",
            label: `Diff v${previous.n}→v${current.n}`,
            content: (
              <section aria-labelledby="diff-h">
                <h2 id="diff-h" className="sr-only">
                  What changed
                </h2>
                <VersionDiff
                  previous={previous.body}
                  current={current.body}
                  resolved={resolvedByChange}
                  previousN={previous.n}
                  currentN={current.n}
                />
              </section>
            ),
          },
        ]
      : []),
    {
      value: "comments",
      label: "Comments",
      count: comments.length,
      content: current ? (
        <Comments
          contentId={content.id}
          versionId={current.id}
          comments={comments}
          members={(profiles ?? []).map((p) => p.display_name).filter((n): n is string => !!n)}
          findings={findings.map((f) => ({
            id: f.id,
            label: `${f.codes} “${f.quote.slice(0, 40)}”`,
          }))}
        />
      ) : null,
    },
    ...(auditPanel ? [{ value: "audit", label: "Audit", content: auditPanel }] : []),
  ];

  return (
    <>
      <RealtimeRefresh
        orgId={content.org_id}
        tables={["contents", "findings", "comments", "review_runs"]}
      />
      <SetCrumb label={content.title} />
      <header className="mb-6 space-y-2">
        <p className="mono-label text-fg-faint">{content.campaigns?.name ?? "Review"}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.75rem] leading-tight tracking-[-0.015em]">{content.title}</h1>
          <StateBadge state={content.state} routeTo={content.route_to} />
          <RiskMeter
            score={content.risk_score}
            blocker={findings.some((f) => f.severity === "blocker" && f.status === "routed")}
          />
          <span className="mono-label bg-accent-deep text-accent-soft rounded-sm px-1.5 py-0.5">
            → {ROUTE_LABEL[content.route_to ?? "manager"]}
          </span>
          {current ? (
            <VersionSwitcher
              current={current.n}
              versions={(versions ?? []).map((x) => ({
                n: x.n,
                at: x.created_at,
                latest: x.id === latest?.id,
                href:
                  x.id === latest?.id ? `/review/${content.id}` : `/review/${content.id}?v=${x.n}`,
              }))}
            />
          ) : null}
        </div>
        <p className="text-fg-muted text-sm">
          By {name.get(content.owner_id) ?? "Someone"} ·{" "}
          <span className="font-mono text-xs">{routingReason(content.route_to, findings)}</span>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="version-h"
          className="border-outline bg-code min-w-0 self-start rounded-lg border-2 lg:sticky lg:top-20"
        >
          <div className="bg-band-grey border-outline flex h-10 items-center gap-2 rounded-t-[14px] border-b-2 px-4">
            <span aria-hidden className="flex gap-1.5">
              <span className="bg-fg size-2 rounded-full" />
              <span className="bg-fg size-2 rounded-full" />
              <span className="bg-fg size-2 rounded-full" />
            </span>
            <h2 id="version-h" className="text-fg text-sm font-semibold">
              Draft · version {current?.n ?? "–"} · read-only
            </h2>
          </div>
          <div className="p-5">
            {current?.body ? (
              <HighlightedText
                text={current.body}
                spans={findings
                  .filter((f) => f.status === "open" || f.status === "routed")
                  .map((f) => ({
                    id: f.id,
                    start: f.span.start,
                    end: f.span.end,
                    severity: f.severity,
                    label: `${f.severity} ${f.codes}`,
                  }))}
              />
            ) : pdfPages.length ? (
              <PdfFindings title={content.title} pages={pdfPages} markers={pdfMarkers} />
            ) : imageUrl ? (
              <ImageFindings
                src={imageUrl}
                alt={altText || `${content.title} (uploaded image, version ${current?.n})`}
                markers={markers}
              />
            ) : (
              <p className="text-fg-muted text-sm">This version is a {current?.format} file.</p>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="findings-h">
            <h2 id="findings-h" className="sr-only">
              Findings
            </h2>
            <ReviewTabs panels={panels} />
          </section>
          <section
            aria-labelledby="decision-h"
            className="border-outline bg-elevated sticky bottom-3 z-10 rounded-lg border-2 p-4"
          >
            <h2 id="decision-h" className="mono-label text-fg-faint mb-3">
              Decision
            </h2>
            {viewingOld ? (
              <p className="text-sm">
                You&apos;re viewing v{current?.n}. Decisions apply to the latest version.{" "}
                <Link href={`/review/${content.id}`} className="text-accent-soft underline">
                  View v{latest?.n}
                </Link>
              </p>
            ) : (
              <DecisionBar
                contentId={content.id}
                state={content.state}
                can={can}
                openWarnings={openWarnings}
              />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
