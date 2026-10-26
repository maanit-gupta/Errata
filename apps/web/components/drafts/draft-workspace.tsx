"use client";

import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { StateBadge, type ContentState } from "@/components/state-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveFinding, submitForCheck } from "@/lib/drafts/actions";
import { revise } from "@/lib/review/actions";
import { CHANNELS, intentSchema, type Intent } from "@/lib/drafts/intent";
import {
  FindingHighlights,
  currentRange,
  findingsKey,
  type HighlightRange,
} from "@/lib/editor/findings-extension";
import { docToText, spanToRange, textToDocJSON } from "@/lib/editor/offsets";
import { FindingCard, type FindingView } from "./finding-card";
import { ImageFindings, type ImageMarker } from "./image-findings";
import { PdfFindings, pageSummary, type PdfMarker } from "./pdf-findings";
import type { PdfPageView } from "@/lib/drafts/pages";

const SEVERITY_ORDER = { blocker: 0, warning: 1, suggestion: 2 } as const;

type Props = {
  content: { id: string; title: string; state: ContentState; channel: string; campaignId: string };
  campaigns: { id: string; name: string }[];
  version: {
    id: string;
    n: number;
    body: string | null;
    intent: Partial<Intent>;
    format: string;
  } | null;
  run: { id: string; status: string; degraded: boolean; error_code: string | null } | null;
  findings: FindingView[];
  /** Signed URL of the current version's image (image versions only). */
  imageUrl: string | null;
  /** Rendered pages of the current PDF version, once its check has run (P12). */
  pdfPages?: PdfPageView[];
  canEdit: boolean;
  canAct: boolean;
};

export function DraftWorkspace({
  content,
  campaigns,
  version,
  run,
  findings,
  imageUrl,
  pdfPages = [],
  canEdit,
  canAct,
}: Props) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [allPages, setAllPages] = useState(false);
  // "Show on page N" pins its finding: scrolling moves the card from under the pointer, and the
  // resulting mouseleave must not clear the box it just pointed at.
  const [pinned, setPinned] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Intent, string>>>({});
  const [intent, setIntent] = useState<Partial<Intent>>({
    goal: "",
    audience: "",
    cta: "",
    channel: content.channel,
    ...version?.intent,
    campaign_id: version?.intent.campaign_id ?? content.campaignId,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      FindingHighlights,
    ],
    content: textToDocJSON(version?.body ?? ""),
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": "Draft text", "aria-multiline": "true", role: "textbox" },
    },
  });

  // Defensive rendering (invariant 1): never show a finding without a citation.
  const visible = useMemo(() => {
    const cited = findings.filter((f) => {
      const ok = f.citations.length > 0;
      if (!ok && process.env.NODE_ENV !== "production")
        console.error("[findings] dropped uncited finding", f.id);
      return ok;
    });
    return cited.sort(
      (a, b) =>
        Number(a.status !== "open") - Number(b.status !== "open") ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.span.start - b.span.start,
    );
  }, [findings]);

  // Place highlights when a run's findings arrive, provided the editor still shows that version.
  const placedRun = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || !version?.body || !run) return;
    const text = docToText(editor.state.doc);
    const key = `${run.id}:${visible.map((f) => f.id + f.status).join(",")}`;
    if (placedRun.current === key) return;
    if (text !== version.body && placedRun.current?.startsWith(run.id)) return;
    placedRun.current = key;
    const ranges: HighlightRange[] =
      text === version.body
        ? visible
            .filter((f) => f.status === "open")
            .map((f) => ({
              id: f.id,
              severity: f.severity,
              ...spanToRange(editor.state.doc, version.body!, f.span),
            }))
        : [];
    editor.view.dispatch(editor.state.tr.setMeta(findingsKey, { ranges }));
  }, [editor, version?.body, run, visible]);

  const imageVersion = version?.format === "image" && !!imageUrl;
  const pdfVersion = version?.format === "pdf";
  // Uploaded files (images, PDFs) are fixed in the design and re-checked on the next upload.
  const fileVersion = version?.format === "image" || pdfVersion;
  const pdfMarkers: PdfMarker[] = pdfVersion
    ? visible
        .filter((f) => f.box && f.page && f.status === "open")
        .map((f) => ({
          id: f.id,
          severity: f.severity,
          codes: f.citations.map((c) => c.code).join(" · "),
          label: f.quote,
          box: f.box!,
          page: f.page!,
        }))
    : [];
  const markers: ImageMarker[] = imageVersion
    ? visible
        .filter((f) => f.box && f.status === "open")
        .map((f) => ({
          id: f.id,
          severity: f.severity,
          codes: f.citations.map((c) => c.code).join(" · "),
          label: f.quote,
          box: f.box!,
        }))
    : [];
  // Numbered like the overlay: per image, or per page of a PDF.
  const markerNumber = new Map([
    ...markers.map((m, i) => [m.id, i + 1] as const),
    ...pdfMarkers.map(
      (m) =>
        [
          m.id,
          pdfMarkers.filter((x) => x.page === m.page).findIndex((x) => x.id === m.id) + 1,
        ] as const,
    ),
  ]);

  const focus = (fid: string | null, scroll = false) => {
    if (fid && fid !== pinned) setPinned(null);
    setActive(fid ?? pinned);
    // PDFs: keyboard focus on a finding from another page turns to that page.
    const onPage = fid ? visible.find((f) => f.id === fid)?.page : null;
    if (pdfVersion && onPage && scroll && onPage !== page) setPage(onPage);
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(findingsKey, { active: fid }));
    // Scroll only for keyboard focus; scrolling on hover moves the card under the pointer.
    if (fid && scroll)
      editor.view.dom
        .querySelector(`[data-finding-id="${fid}"]`)
        ?.scrollIntoView({ block: "nearest" });
  };

  const showOnPage = (f: FindingView) => {
    if (!f.page) return;
    setPage(f.page);
    setActive(f.id);
    setPinned(f.id);
    document.getElementById(`${id}-editor`)?.scrollIntoView({ block: "start" });
  };

  const removeHighlight = (fid: string) => {
    if (!editor) return;
    const ranges = (findingsKey.getState(editor.state)?.ranges ?? []).filter((r) => r.id !== fid);
    editor.view.dispatch(editor.state.tr.setMeta(findingsKey, { ranges }));
  };

  const apply = async (f: FindingView, text: string, status: "accepted" | "edited") => {
    if (fileVersion) {
      // Nothing to patch in place: alt text lives in the intent; everything else is fixed in the
      // design and verified when the corrected image is uploaded.
      if (f.target === "alt_text") setIntent((s) => ({ ...s, alt_text: text }));
      const r = await resolveFinding({ id: f.id, status });
      if (!r.ok) toast.error(r.error);
      else
        toast.success(
          f.target === "alt_text"
            ? "Alt text updated. Resubmit to check it."
            : `Marked fixed. Upload the corrected ${pdfVersion ? "PDF" : "image"} to resubmit.`,
        );
      router.refresh();
      return;
    }
    if (!editor) return;
    const range = currentRange(editor.state, f.id);
    if (!range) {
      toast.error("That text has changed since the check. Edit it directly instead.");
      return;
    }
    editor.view.dispatch(editor.state.tr.insertText(text, range.from, range.to));
    removeHighlight(f.id);
    const r = await resolveFinding({ id: f.id, status });
    if (r.ok) toast.success(status === "accepted" ? "Fix applied." : "Your fix was applied.");
    else toast.error(r.error);
    router.refresh();
  };

  const resolve: Parameters<typeof FindingCard>[0]["onResolve"] = async (f, patch) => {
    const r = await resolveFinding({ id: f.id, ...patch } as Parameters<typeof resolveFinding>[0]);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (patch.status !== "open") removeHighlight(f.id);
    toast.success(
      patch.status === "routed"
        ? "Routed to legal."
        : patch.status === "open"
          ? "Reopened."
          : "Dismissed.",
    );
    router.refresh();
  };

  // PDFs: the list follows the page on screen unless "Show all pages" is on.
  const shown =
    pdfVersion && pdfPages.length && !allPages
      ? visible.filter((f) => !f.page || f.page === page)
      : visible;

  const openBlockers = visible.filter(
    (f) => f.severity === "blocker" && f.status === "open",
  ).length;
  const checking =
    content.state === "ai_check" || run?.status === "queued" || run?.status === "running";
  const resubmitBlocked = content.state === "needs_revision" && openBlockers > 0;
  const fileKind = file
    ? file.type.startsWith("image/")
      ? "image"
      : file.type === "application/pdf"
        ? "pdf"
        : "docx"
    : null;
  const showAlt = fileKind === "image" || (!file && version?.format === "image");

  const submit = () => {
    const parsed = intentSchema.safeParse(intent);
    if (!parsed.success) {
      const errs: Partial<Record<keyof Intent, string>> = {};
      for (const issue of parsed.error.issues)
        errs[issue.path[0] as keyof Intent] ??= issue.message;
      setErrors(errs);
      toast.error("Fill in the intent first.");
      return;
    }
    setErrors({});
    start(async () => {
      let upload: FormData | undefined;
      if (file) {
        upload = new FormData();
        upload.set("file", file);
      }
      const r = await submitForCheck(
        {
          contentId: content.id,
          body: editor ? docToText(editor.state.doc) : "",
          intent: parsed.data,
        },
        upload,
      );
      if (r.ok) toast.success(r.message ?? "Submitted.");
      else toast.error(r.error);
      router.refresh();
    });
  };

  const field = (key: keyof Intent, label: string, placeholder = "") => (
    <div className="space-y-1">
      <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={`${id}-${key}`}
        value={String(intent[key] ?? "")}
        placeholder={placeholder}
        disabled={!canEdit}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-err` : undefined}
        onChange={(e) => setIntent((s) => ({ ...s, [key]: e.target.value }))}
      />
      {errors[key] ? (
        <p id={`${id}-${key}-err`} className="text-accent-text text-xs">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <section
          aria-labelledby={`${id}-editor`}
          className="border-border bg-card rounded-lg border"
        >
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <h2 id={`${id}-editor`} className="font-sans text-sm font-medium">
              {pdfVersion ? "PDF" : imageVersion ? "Image" : "Draft"}{" "}
              {version ? `· version ${version.n}` : ""}
            </h2>
            <StateBadge state={content.state} />
          </div>
          {pdfVersion ? (
            <div className="px-4 py-3">
              {pdfPages.length ? (
                <PdfFindings
                  title={content.title}
                  pages={pdfPages}
                  markers={checking ? [] : pdfMarkers}
                  page={page}
                  onPageChange={(n) => {
                    setPage(n);
                    setActive(null);
                    setPinned(null);
                  }}
                  active={active}
                  onFocus={focus}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {checking
                    ? "Reading the PDF and rendering its pages…"
                    : "The PDF's pages appear here after its check."}
                </p>
              )}
            </div>
          ) : imageVersion ? (
            <div className="px-4 py-3">
              <ImageFindings
                src={imageUrl!}
                alt={intent.alt_text || `${content.title} (uploaded image, version ${version!.n})`}
                markers={checking ? [] : markers}
                active={active}
                onFocus={focus}
              />
            </div>
          ) : (
            <div className="draft-editor px-4 py-3">
              <EditorContent editor={editor} />
            </div>
          )}
          {canEdit ? (
            <div className="border-border border-t px-4 py-3 text-sm">
              <label htmlFor={`${id}-file`} className="font-medium">
                {imageVersion
                  ? "Upload the corrected image (PNG, JPEG or WebP)"
                  : pdfVersion
                    ? "Upload the corrected PDF"
                    : "Or upload a file (DOCX, PDF or image)"}
              </label>
              <input
                id={`${id}-file`}
                type="file"
                accept=".docx,.pdf,.png,.jpg,.jpeg,.webp"
                className="mt-1 block"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {fileKind === "pdf" ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Up to 40 pages. Every text rule runs on the PDF&apos;s text, plus contrast, hidden
                  text, link text, the logo and the pictures on each page.
                </p>
              ) : fileKind === "image" ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Images are checked for logo use, palette, text contrast, hidden fine print, alt
                  text and image style, plus every text rule on the words in the picture.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section aria-labelledby={`${id}-findings`} aria-live="polite">
          <h2 id={`${id}-findings`} className="font-heading mb-3 text-xl">
            Findings{" "}
            {visible.length ? (
              <span className="text-muted-foreground font-mono text-sm">({visible.length})</span>
            ) : null}
          </h2>
          {run?.degraded ? (
            <p
              role="status"
              className="border-warning bg-warning-surface text-warning mb-3 rounded-md border p-3 text-sm"
            >
              The AI check was unavailable, so only deterministic checks ran. Resubmit later for
              tone and claims review.
            </p>
          ) : null}
          {run?.status === "failed" ? (
            <p
              role="alert"
              className="border-accent-text text-accent-text mb-3 rounded-md border p-3 text-sm"
            >
              The check failed ({run.error_code}). Your draft is back in your hands; try again.
            </p>
          ) : null}
          {pdfVersion && pdfPages.length && visible.length && !checking ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <p className="m-0">
                {allPages
                  ? `All ${pdfPages.length} pages`
                  : `Page ${page}: ${pageSummary(pdfMarkers, page)}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={allPages}
                onClick={() => setAllPages((v) => !v)}
              >
                Show all pages
              </Button>
            </div>
          ) : null}
          {checking ? (
            <p className="text-muted-foreground text-sm">Checking against your brand vault…</p>
          ) : shown.length ? (
            <ul className="space-y-3">
              {shown.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  active={active === f.id}
                  canAct={canAct}
                  imageMode={fileVersion}
                  marker={markerNumber.get(f.id)}
                  onFocus={focus}
                  onShow={pdfVersion ? showOnPage : undefined}
                  onApply={apply}
                  onResolve={resolve}
                />
              ))}
            </ul>
          ) : visible.length ? (
            <p className="text-sm">
              No findings on page {page}.{" "}
              <button type="button" className="underline" onClick={() => setAllPages(true)}>
                Show all pages
              </button>
            </p>
          ) : run?.status === "done" ? (
            <p className="text-sm">
              No findings. This draft follows every approved rule BrandLens checked.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Submit the draft to check it.</p>
          )}
        </section>
      </div>

      <aside
        aria-labelledby={`${id}-intent`}
        className="space-y-4 lg:sticky lg:top-6 lg:self-start"
      >
        <section className="border-border bg-card space-y-3 rounded-lg border p-4">
          <h2 id={`${id}-intent`} className="font-heading text-lg">
            What is it for?
          </h2>
          {field("goal", "Goal", "webinar sign-ups")}
          {field("audience", "Audience", "first-time investors")}
          {field("cta", "Call to action", "Register now")}
          <div className="space-y-1">
            <label htmlFor={`${id}-channel`} className="text-sm font-medium">
              Channel
            </label>
            <select
              id={`${id}-channel`}
              disabled={!canEdit}
              value={intent.channel ?? ""}
              onChange={(e) => setIntent((s) => ({ ...s, channel: e.target.value }))}
              className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-campaign`} className="text-sm font-medium">
              Campaign
            </label>
            <select
              id={`${id}-campaign`}
              disabled
              value={intent.campaign_id ?? ""}
              className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Facts are checked against this campaign.
            </p>
          </div>
          {showAlt ? (
            <div className="space-y-1">
              <label htmlFor={`${id}-alt`} className="text-sm font-medium">
                Alt text
              </label>
              <textarea
                id={`${id}-alt`}
                rows={3}
                value={intent.alt_text ?? ""}
                disabled={!canEdit}
                aria-describedby={`${id}-alt-help`}
                onChange={(e) => setIntent((s) => ({ ...s, alt_text: e.target.value }))}
                className="border-input bg-card w-full rounded-md border px-2 py-1.5 text-sm"
              />
              <p id={`${id}-alt-help`} className="text-muted-foreground text-xs">
                What the image says, including its call to action. Missing alt text fails WCAG
                1.1.1.
              </p>
            </div>
          ) : null}
        </section>

        {canEdit ? (
          <div className="space-y-2">
            <Button
              className="h-10 w-full"
              disabled={pending || checking || resubmitBlocked}
              onClick={submit}
              aria-describedby={`${id}-submit-help`}
            >
              {content.state === "needs_revision" ? "Resubmit for check" : "Submit for check"}
            </Button>
            <p
              id={`${id}-submit-help`}
              className="text-muted-foreground text-xs"
              aria-live="polite"
            >
              {resubmitBlocked
                ? `${openBlockers} blocker${openBlockers === 1 ? "" : "s"} still open: accept, edit, dismiss with a reason, or route each one.`
                : checking
                  ? "A check is running."
                  : (imageVersion || pdfVersion) && !file
                    ? `Upload the corrected ${pdfVersion ? "PDF" : "image"} above, then resubmit. Nothing is ever published automatically.`
                    : "Saves a new version and checks it. Nothing is ever published automatically."}
            </p>
          </div>
        ) : canAct && content.state === "changes_requested" ? (
          <div className="border-accent-text space-y-2 rounded-md border p-3 text-sm">
            <p>A reviewer asked for changes. See their reason on the review page.</p>
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await revise(content.id);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.error);
                  router.refresh();
                })
              }
            >
              Start revising
            </Button>
          </div>
        ) : (
          <p className="bg-muted rounded-md p-3 text-sm">
            {content.state === "ai_check"
              ? "Checking…"
              : "This draft is with reviewers and can't be edited right now."}{" "}
            <a href={`/review/${content.id}`} className="underline">
              Review status
            </a>
          </p>
        )}
      </aside>
    </div>
  );
}
