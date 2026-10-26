import { notFound } from "next/navigation";
import { ImageFindings } from "@/components/drafts/image-findings";
import { PdfFindings } from "@/components/drafts/pdf-findings";
import { IdBadge } from "@/components/brand/id-badge";
import { PageHeader } from "@/components/brand/page-header";
import { Comments, type CommentView } from "@/components/review/comments";
import { DecisionBar } from "@/components/review/decision-bar";
import { HighlightedText } from "@/components/review/highlighted-text";
import { VersionDiff } from "@/components/review/version-diff";
import { SeverityBadge } from "@/components/brand/severity-badge";
import { StateBadge } from "@/components/brand/state-badge";
import { RealtimeRefresh } from "@/components/vault/realtime-refresh";
import { requireSession } from "@/lib/auth/session";
import { signedPages } from "@/lib/drafts/pages";
import { spanBox, spanPage } from "@/lib/drafts/span";
import { createClient } from "@/lib/supabase/server";
import { can as canDo } from "@/lib/workflow/permissions";

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

export default async function ReviewContentPage({ params }: PageProps<"/review/[contentId]">) {
  const { contentId } = await params;
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
  const current = versions?.find((v) => v.id === content.current_version_id) ?? versions?.[0];
  const previous = versions?.find((v) => current && v.n === current.n - 1);
  const versionIds = (versions ?? []).map((v) => v.id);

  const [{ data: profiles }, { data: findingRows }, { data: decisions }, { data: commentRows }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name"),
      versionIds.length
        ? supabase
            .from("findings")
            .select(
              "id, version_id, run_id, dimension, severity, status, quote, span, explanation, source, confidence, resolved_by, dismiss_reason, rule_id, fact_id, wcag_ref, created_at",
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
        ? supabase.from("rule_cards_public").select("id, code").in("id", ruleIds)
        : supabase.from("rule_cards").select("id, code").in("id", ruleIds)
      : Promise.resolve({ data: [] as { id: string | null; code: string | null }[] }),
    factIds.length
      ? supabase.from("facts").select("id, code").in("id", factIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
  ]);
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
  // Image versions render from a short-lived signed URL (private bucket, SPEC §3).
  const imageUrl =
    current?.format === "image" && current.storage_path
      ? ((await supabase.storage.from("drafts").createSignedUrl(current.storage_path, 3600)).data
          ?.signedUrl ?? null)
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

  return (
    <>
      <RealtimeRefresh
        orgId={content.org_id}
        tables={["contents", "findings", "comments", "review_runs"]}
      />
      <PageHeader
        eyebrow={`${content.campaigns?.name ?? "Review"} · version ${current?.n ?? "–"}`}
        title={content.title}
        actions={<StateBadge state={content.state} />}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section
            aria-labelledby="version-h"
            className="border-border bg-card rounded-lg border p-5"
          >
            <h2 id="version-h" className="font-heading mb-3 text-xl">
              Draft
            </h2>
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
              <p className="text-muted-foreground text-sm">
                This version is a {current?.format} file.
              </p>
            )}
          </section>

          <section aria-labelledby="findings-h">
            <h2 id="findings-h" className="font-heading mb-3 text-xl">
              Findings
            </h2>
            <ul className="space-y-2">
              {findings.map((f) => (
                <li
                  key={f.id}
                  id={`finding-${f.id}`}
                  className="border-border bg-card scroll-mt-4 rounded-lg border p-3 text-sm"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    {f.codes.split(" · ").map((c) => (
                      <IdBadge key={c} code={c} />
                    ))}
                    <span className="text-muted-foreground">{f.dimension}</span>
                    {f.source === "llm" ? (
                      <span className="border-border rounded-full border px-2 text-xs">
                        AI-assisted
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs font-medium">
                      {f.status}
                      {f.resolved_by ? ` by ${name.get(f.resolved_by) ?? "someone"}` : ""}
                      {f.dismiss_reason ? ` (${f.dismiss_reason.replace("_", " ")})` : ""}
                    </span>
                  </p>
                  <p className="mt-1">“{f.quote}”</p>
                  <p className="text-muted-foreground mt-1">{f.explanation}</p>
                  {pdfPages.length && pageOf.get(f.id) ? (
                    <p className="mt-1">
                      <a href={`#show-${f.id}`} className="text-sm underline underline-offset-2">
                        Show on page {pageOf.get(f.id)}
                      </a>
                    </p>
                  ) : null}
                </li>
              ))}
              {findings.length ? null : (
                <li className="text-muted-foreground text-sm">No findings on this version.</li>
              )}
            </ul>
          </section>

          {previous?.body && current?.body ? (
            <section aria-labelledby="diff-h">
              <h2 id="diff-h" className="font-heading mb-3 text-xl">
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
          ) : null}

          <section aria-labelledby="comments-h">
            <h2 id="comments-h" className="font-heading mb-3 text-xl">
              Comments
            </h2>
            {current ? (
              <Comments
                contentId={content.id}
                versionId={current.id}
                comments={comments}
                members={(profiles ?? [])
                  .map((p) => p.display_name)
                  .filter((n): n is string => !!n)}
                findings={findings.map((f) => ({
                  id: f.id,
                  label: `${f.codes} “${f.quote.slice(0, 40)}”`,
                }))}
              />
            ) : null}
          </section>

          {audit ? (
            <section aria-labelledby="audit" id="audit">
              <h2 id="audit-h" className="font-heading mb-3 text-xl">
                Audit trail
              </h2>
              <ol className="space-y-1 text-sm">
                {trail.map((a) => {
                  const e = a.event as Record<string, string | null>;
                  return (
                    <li key={a.id} className="border-border flex flex-wrap gap-x-2 border-b py-1.5">
                      <time className="text-muted-foreground font-mono text-xs" dateTime={a.at}>
                        {new Date(a.at).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </time>
                      <span className="font-medium">
                        {a.actor_id ? (name.get(a.actor_id) ?? "Someone") : "BrandLens"}
                      </span>
                      <span>
                        {e.type === "transition"
                          ? `${e.from} → ${e.to}`
                          : e.type === "finding_status"
                            ? `finding ${e.from} → ${e.to}`
                            : String(e.type)}
                      </span>
                      {e.reason ? (
                        <span className="text-muted-foreground">“{e.reason}”</span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Decision">
          <section className="border-border bg-card space-y-2 rounded-lg border p-4 text-sm">
            <h2 className="font-heading text-lg">Routing</h2>
            <p>
              <span className="font-medium">{ROUTE_LABEL[content.route_to ?? "manager"]}</span> ·
              risk <span className="font-mono">{content.risk_score ?? "–"}</span>
            </p>
            <p className="text-muted-foreground">{routingReason(content.route_to, findings)}</p>
          </section>
          <section className="border-border bg-card rounded-lg border p-4">
            <h2 className="font-heading mb-3 text-lg">Decision</h2>
            <DecisionBar
              contentId={content.id}
              state={content.state}
              can={can}
              openWarnings={openWarnings}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
