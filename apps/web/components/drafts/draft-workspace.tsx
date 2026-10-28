"use client";

import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { DegradedBanner } from "@/components/brand/degraded-banner";
import { EmptyState } from "@/components/brand/empty-state";
import { ErrorPanel } from "@/components/brand/error-panel";
import { RunPanel, type RunStatus } from "@/components/brand/run-panel";
import { Spinner } from "@/components/brand/spinner";
import { StateBadge, type ContentState } from "@/components/brand/state-badge";
import { VersionSwitcher, type VersionOption } from "@/components/brand/version-switcher";
import { WordCounter } from "@/components/brand/word-counter";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { countWords, MAX_WORDS, PDF_MAX_PAGES } from "@/lib/drafts/limits";
import { cn } from "@/lib/utils";
import { resolveFinding, submitForCheck } from "@/lib/drafts/actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/limits";
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
  content: {
    id: string;
    title: string;
    state: ContentState;
    routeTo?: string | null;
    channel: string;
    campaignId: string;
  };
  campaigns: { id: string; name: string; status?: string }[];
  version: {
    id: string;
    n: number;
    body: string | null;
    intent: Partial<Intent>;
    format: string;
  } | null;
  run: {
    id: string;
    status: string;
    degraded: boolean;
    error_code: string | null;
    provider: string | null;
    model: string | null;
    prompt: string | null;
    timings: Record<string, unknown> | null;
  } | null;
  findings: FindingView[];
  /** Signed URL of the current version's image (image versions only). */
  imageUrl: string | null;
  /** Rendered pages of the current PDF version, once its check has run (P12). */
  pdfPages?: PdfPageView[];
  canEdit: boolean;
  canAct: boolean;
  /** Agency viewers: citations show rule summaries only. */
  summaryView?: boolean;
  /** Every version, newest first; older ones open read-only on the review page. */
  versions?: VersionOption[];
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
  summaryView = false,
  versions = [],
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
  const [fileError, setFileError] = useState<string | null>(null);
  // Reject over-long PDFs before uploading (SPEC §14); the worker enforces it too.
  const pickFile = async (f: File | null) => {
    setFileError(null);
    setFile(f);
    if (f?.type === "application/pdf") {
      const text = new TextDecoder("latin1").decode(await f.arrayBuffer());
      const pages = (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
      if (pages > PDF_MAX_PAGES) {
        setFile(null);
        setFileError(`This PDF has ${pages} pages; the limit is ${PDF_MAX_PAGES}.`);
      }
    }
  };
  const [errors, setErrors] = useState<Partial<Record<keyof Intent, string>>>({});
  const [intent, setIntent] = useState<Partial<Intent>>({
    goal: "",
    audience: "",
    cta: "",
    channel: content.channel,
    ...version?.intent,
    campaign_id: version?.intent.campaign_id ?? content.campaignId,
  });

  const [words, setWords] = useState(() => countWords(version?.body ?? ""));
  const editor = useEditor({
    onUpdate: ({ editor: e }) => setWords(countWords(docToText(e.state.doc))),
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
    // Activation (click or keyboard focus) pins the selection: the scroll it causes fires a
    // mouseleave on the overlay box, which must not clear the highlight.
    if (fid && scroll) setPinned(fid);
    else if (fid && fid !== pinned) setPinned(null);
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

  // DESIGN.md §7.4: j/k move between findings; a/e/x act on the focused one when allowed.
  useEffect(() => {
    const onKey = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      const cards = [...document.querySelectorAll<HTMLElement>("li[data-finding]")];
      if (!cards.length) return;
      const current = cards.findIndex((c) => c.contains(document.activeElement));
      if (key === "j" || key === "k") {
        const next =
          current < 0 ? 0 : (current + (key === "j" ? 1 : -1) + cards.length) % cards.length;
        cards[next].querySelector<HTMLElement>("h3 button")?.focus();
        return;
      }
      if (current < 0) return;
      const label = { a: /^Accept fix$|^Mark fixed/, e: /^Edit$/, x: /^Dismiss$/ }[key];
      if (!label) return;
      const card = cards[current];
      const header = card.querySelector<HTMLElement>('h3 button[aria-expanded="false"]');
      header?.click();
      requestAnimationFrame(() => {
        const btn = [...card.querySelectorAll<HTMLButtonElement>("button")].find(
          (b) =>
            label.test(b.textContent?.trim() ?? "") &&
            !b.disabled &&
            b.getAttribute("aria-disabled") !== "true",
        );
        btn?.click();
      });
    };
    window.addEventListener("bl-finding-key", onKey);
    return () => window.removeEventListener("bl-finding-key", onKey);
  }, []);

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
      if (file && file.size > MAX_UPLOAD_BYTES) {
        toast.error(`Files must be under ${MAX_UPLOAD_LABEL}.`);
        return;
      }
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

  const overLimit = !fileVersion && !file && words > MAX_WORDS;
  const missing = (
    [
      ["goal", "goal"],
      ["audience", "audience"],
      ["cta", "call to action"],
      ["channel", "channel"],
      ["campaign_id", "campaign"],
    ] as const
  )
    .filter(([k]) => !String(intent[k] ?? "").trim())
    .map(([, label]) => label);
  const campaign = campaigns.find((c) => c.id === intent.campaign_id);
  const channelLabel = CHANNELS.find((c) => c.value === (intent.channel ?? content.channel))?.label;
  const kindLabel = pdfVersion ? "PDF" : imageVersion ? "Image" : "Draft";
  const counts = {
    blocker: visible.filter((f) => f.status === "open" && f.severity === "blocker").length,
    warning: visible.filter((f) => f.status === "open" && f.severity === "warning").length,
    suggestion: visible.filter((f) => f.status === "open" && f.severity === "suggestion").length,
  };
  const submitDisabled = pending || checking || resubmitBlocked || missing.length > 0 || overLimit;
  const submitWhy = checking
    ? "A check is running."
    : missing.length
      ? `Intent is required. Missing: ${missing.join(", ")}.`
      : overLimit
        ? `This draft has ${words.toLocaleString("en-IN")} words; the limit is ${MAX_WORDS.toLocaleString("en-IN")}.`
        : resubmitBlocked
          ? `${openBlockers} blocker${openBlockers === 1 ? "" : "s"} still open: accept, edit, dismiss with a reason, or route each one.`
          : (imageVersion || pdfVersion) && !file
            ? `Upload the corrected ${pdfVersion ? "PDF" : "image"}, then resubmit. Nothing is ever published automatically.`
            : "Saves a new version and checks it. Nothing is ever published automatically.";
  const submitLabel =
    content.state === "needs_revision" ? "Resubmit for check" : "Submit for check";

  const submitButton = (
    <Button
      size="lg"
      disabled={submitDisabled}
      focusableWhenDisabled
      onClick={submit}
      aria-describedby={`${id}-submit-help`}
    >
      {pending ? "Submitting…" : submitLabel}
    </Button>
  );

  const field = (key: keyof Intent, label: string, help: string, placeholder = "") => (
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
        aria-describedby={`${id}-${key}-help${errors[key] ? ` ${id}-${key}-err` : ""}`}
        onChange={(e) => setIntent((s) => ({ ...s, [key]: e.target.value }))}
      />
      <p id={`${id}-${key}-help`} className="text-fg-faint text-xs">
        {help}
      </p>
      {errors[key] ? (
        <p id={`${id}-${key}-err`} className="text-danger text-xs">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  const intentPanel = (
    <section
      aria-labelledby={`${id}-intent`}
      className="border-outline bg-elevated space-y-4 rounded-lg border-2 p-4"
    >
      <h2 id={`${id}-intent`} className="mono-label text-accent-soft">
        Intent · required
      </h2>
      {field("goal", "Goal", "What should this content achieve?", "webinar sign-ups")}
      {field(
        "audience",
        "Audience",
        "Who is this for? e.g. first-time investors",
        "first-time investors",
      )}
      {field("cta", "Call to action", "Rewrites must keep it.", "Register now")}
      <div className="space-y-1">
        <label htmlFor={`${id}-channel`} className="text-sm font-medium">
          Channel
        </label>
        <select
          id={`${id}-channel`}
          disabled={!canEdit}
          value={intent.channel ?? ""}
          onChange={(e) => setIntent((s) => ({ ...s, channel: e.target.value }))}
          className={fieldClass}
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
          className={fieldClass}
          aria-describedby={`${id}-campaign-help`}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {(c.status ?? "").toUpperCase()}
            </option>
          ))}
        </select>
        <p
          id={`${id}-campaign-help`}
          className={cn("text-xs", campaign?.status === "ended" ? "text-warning" : "text-fg-faint")}
        >
          {campaign?.status === "ended"
            ? "This campaign has ended. Its facts may be out of date."
            : "Facts are checked against this campaign."}
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-notes`} className="text-sm font-medium">
          Notes <span className="text-fg-faint font-normal">(optional)</span>
        </label>
        <textarea
          id={`${id}-notes`}
          rows={2}
          value={intent.notes ?? ""}
          disabled={!canEdit}
          onChange={(e) => setIntent((s) => ({ ...s, notes: e.target.value }))}
          className={fieldClass}
        />
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
            className={fieldClass}
          />
          <p id={`${id}-alt-help`} className="text-fg-faint text-xs">
            What the image says, including its call to action. Missing alt text fails WCAG 1.1.1.
          </p>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="mono-label text-fg-faint">{campaign?.name ?? "Draft"}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.75rem] leading-tight tracking-[-0.015em]">{content.title}</h1>
            <StateBadge state={content.state} routeTo={content.routeTo} />
            {version ? <VersionSwitcher current={version.n} versions={versions} /> : null}
          </div>
        </div>
        {canEdit && content.state !== "needs_revision" ? submitButton : null}
      </header>
      {canEdit && content.state !== "needs_revision" ? (
        <p id={`${id}-submit-help`} className="text-fg-muted -mt-2 text-xs" aria-live="polite">
          {submitWhy}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[280px_minmax(0,1fr)_400px]">
        <div className="lg:col-span-2 xl:sticky xl:top-20 xl:col-span-1 xl:self-start">
          {intentPanel}
        </div>

        <section
          aria-labelledby={`${id}-editor`}
          className="border-outline bg-code min-w-0 self-start rounded-lg border-2"
        >
          <div className="bg-band-grey border-outline flex min-h-10 flex-wrap items-center gap-2 rounded-t-[14px] border-b-2 px-4 py-2">
            <span aria-hidden className="flex gap-1.5">
              <span className="bg-fg size-2 rounded-full" />
              <span className="bg-fg size-2 rounded-full" />
              <span className="bg-fg size-2 rounded-full" />
            </span>
            <h2 id={`${id}-editor`} className="text-fg text-sm font-semibold">
              {kindLabel} {version ? `· version ${version.n}` : ""}
              <span className="text-fg-faint">
                {channelLabel ? ` · ${channelLabel}` : ""}
                {campaign ? ` · ${campaign.name}` : ""}
                {run && !run.degraded && run.status === "done" ? " · LLM-assisted" : ""}
              </span>
            </h2>
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
                <div className="py-10">
                  {checking ? (
                    <Spinner centered label="Reading the PDF and rendering its pages…" />
                  ) : (
                    <p className="text-fg-muted text-center text-sm">
                      The PDF&apos;s pages appear here after its check.
                    </p>
                  )}
                </div>
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
            <div className="draft-editor px-5 py-4">
              <EditorContent editor={editor} />
            </div>
          )}
          <div className="border-line flex flex-wrap items-start justify-between gap-3 border-t px-4 py-2.5">
            {!fileVersion ? <WordCounter count={words} max={MAX_WORDS} /> : <span />}
            {canEdit ? (
              <div className="min-w-0 text-sm">
                <label htmlFor={`${id}-file`} className="text-fg-muted text-xs">
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
                  className="file:border-control file:text-fg mt-1 block max-w-full text-xs file:mr-2 file:rounded-md file:border file:bg-transparent file:px-2 file:py-1"
                  onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
                  aria-describedby={fileError ? `${id}-file-err` : undefined}
                  aria-invalid={fileError ? true : undefined}
                />
                {fileError ? (
                  <p id={`${id}-file-err`} role="alert" className="text-danger mt-1 text-xs">
                    {fileError}
                  </p>
                ) : null}
                {fileKind === "pdf" ? (
                  <p className="text-fg-faint mt-1 text-xs">
                    Up to {PDF_MAX_PAGES} pages. Text rules run on the PDF&apos;s text, plus
                    contrast, hidden text, link text, the logo and pictures.
                  </p>
                ) : fileKind === "image" ? (
                  <p className="text-fg-faint mt-1 text-xs">
                    Checked for logo use, palette, text contrast, hidden fine print, alt text and
                    image style, plus every text rule on the words in it.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section
          aria-labelledby={`${id}-findings`}
          className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={`${id}-findings`} className="text-xl">
              Findings
              {visible.length ? (
                <span className="mono-id text-fg-faint ml-2">({visible.length})</span>
              ) : null}
            </h2>
            {visible.length ? (
              <p className="mono-id flex gap-2">
                <span className="sr-only">
                  {counts.blocker} blockers, {counts.warning} warnings, {counts.suggestion}{" "}
                  suggestions open
                </span>
                <span aria-hidden className="text-blocker">
                  {counts.blocker}B
                </span>
                <span aria-hidden className="text-warning">
                  {counts.warning}W
                </span>
                <span aria-hidden className="text-suggestion">
                  {counts.suggestion}S
                </span>
              </p>
            ) : null}
          </div>
          <p className="sr-only" aria-live="polite">
            {run?.status === "done" && !checking
              ? `Check finished: ${counts.blocker} blockers, ${counts.warning} warnings, ${counts.suggestion} suggestions.`
              : checking
                ? "Check running."
                : ""}
          </p>

          {run?.degraded && !checking ? (
            <DegradedBanner
              action={
                canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={submitDisabled}
                    focusableWhenDisabled
                    onClick={submit}
                  >
                    Re-run
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {run ? (
            <RunPanel
              defaultOpen={checking || run.status === "failed"}
              run={{
                id: run.id,
                status: (checking && run.status === "done" ? "queued" : run.status) as RunStatus,
                provider: run.provider,
                model: run.model,
                promptVersion: run.prompt,
                timings: run.timings,
                degraded: run.degraded,
                errorCode: run.error_code,
                findings: findings.length,
              }}
            />
          ) : null}
          {run?.status === "failed" ? (
            <ErrorPanel
              title={`The check failed (${run.error_code ?? "unknown error"})`}
              reference={`run ${run.id.slice(0, 8)}`}
              onRetry={canEdit ? submit : undefined}
            >
              Your draft is back in your hands. Try again; if it keeps failing, share the run id.
            </ErrorPanel>
          ) : null}

          {pdfVersion && pdfPages.length && visible.length && !checking ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <p className="text-fg-muted m-0">
                {allPages
                  ? `All ${pdfPages.length} pages`
                  : `Page ${page}: ${pageSummary(pdfMarkers, page)}`}
              </p>
              <Button
                variant="secondary"
                size="xs"
                aria-pressed={allPages}
                onClick={() => setAllPages((v) => !v)}
              >
                Show all pages
              </Button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {checking ? (
              <Spinner centered label="Checking against your brand vault…" />
            ) : shown.length ? (
              <ul className="space-y-2">
                {shown.map((f, i) => (
                  <FindingCard
                    key={f.id}
                    index={i}
                    finding={f}
                    active={active === f.id}
                    canAct={canAct}
                    imageMode={fileVersion}
                    summaryView={summaryView}
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
                <button
                  type="button"
                  className="text-accent-soft font-semibold underline underline-offset-4"
                  onClick={() => setAllPages(true)}
                >
                  Show all pages
                </button>
              </p>
            ) : run?.status === "done" ? (
              <EmptyState glyph="shield" title="No findings" headingLevel={3}>
                This draft follows every approved rule Errata checked.
              </EmptyState>
            ) : (
              <EmptyState glyph="lens" title="Not checked yet" headingLevel={3}>
                Fill in the intent and submit: findings cite the rule or fact they were checked
                against.
              </EmptyState>
            )}
          </div>

          {canEdit && content.state === "needs_revision" ? (
            <div className="border-outline bg-elevated sticky bottom-0 space-y-2 rounded-lg border-2 p-3">
              <p className={cn("mono-label", openBlockers ? "text-blocker" : "text-success")}>
                {openBlockers
                  ? `${openBlockers} blocker${openBlockers === 1 ? "" : "s"} left`
                  : "✓ all blockers handled"}
              </p>
              <div className="[&>button]:w-full">{submitButton}</div>
              <p id={`${id}-submit-help`} className="text-fg-muted text-xs" aria-live="polite">
                {submitWhy}
              </p>
            </div>
          ) : !canEdit && canAct && content.state === "changes_requested" ? (
            <div className="border-warning bg-warning-bg space-y-2 rounded-lg border-2 p-3 text-sm">
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
          ) : !canEdit ? (
            <p className="border-outline text-fg-muted rounded-lg border-2 p-3 text-sm">
              {content.state === "ai_check"
                ? "Checking…"
                : content.state === "publish_ready"
                  ? "Publish-ready. Post it in your own channel."
                  : "This draft is with reviewers and can't be edited right now."}{" "}
              <a
                href={`/review/${content.id}`}
                className="text-accent-soft underline underline-offset-4"
              >
                Review status
              </a>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
