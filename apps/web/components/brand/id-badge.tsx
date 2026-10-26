"use client";

import { Popover } from "@base-ui/react/popover";
import { ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { DIMENSIONS, type Dimension } from "@/components/brand/dimension";
import { cn } from "@/lib/utils";

export type CitationKind = "rule" | "fact" | "wcag";

/** What the SourcePopover shows. Loaded by the server page; RLS already scoped it to the viewer. */
export type CitationSource = {
  title?: string;
  /** Agency viewers get the summary only (SPEC §2 footnote 1). */
  summary?: string;
  body?: string;
  version?: number;
  sourcePage?: number | null;
  dimension?: string;
  neverSend?: boolean;
  /** Vault link (rule card drawer or fact row) when the viewer can open it. */
  href?: string;
  /** Agency view: body withheld. */
  summaryView?: boolean;
};

const WCAG: Record<string, { name: string; slug: string }> = {
  "1.1.1": { name: "Non-text Content", slug: "non-text-content" },
  "1.4.1": { name: "Use of Color", slug: "use-of-color" },
  "1.4.3": { name: "Contrast (Minimum)", slug: "contrast-minimum" },
  "1.4.5": { name: "Images of Text", slug: "images-of-text" },
  "1.4.11": { name: "Non-text Contrast", slug: "non-text-contrast" },
  "1.4.12": { name: "Text Spacing", slug: "text-spacing" },
  "2.4.4": { name: "Link Purpose (In Context)", slug: "link-purpose-in-context" },
  "3.1.5": { name: "Reading Level", slug: "reading-level" },
};

export function wcagInfo(code: string) {
  const num = code.replace(/^WCAG\s*/i, "");
  const w = WCAG[num];
  return {
    num,
    name: w?.name,
    href: `https://www.w3.org/WAI/WCAG22/Understanding/${w?.slug ?? ""}`,
  };
}

const KIND_LABEL: Record<CitationKind, string> = {
  rule: "Rule card",
  fact: "Fact",
  wcag: "WCAG criterion",
};

/**
 * The signature citation chip (DESIGN.md §5 IdBadge): mono lilac code in a hairline box. It is
 * a button that opens the SourcePopover for the rule card, fact or WCAG criterion it cites.
 */
export function IdBadge({
  code,
  kind = "rule",
  source,
  withIcon = false,
  className,
}: {
  code: string;
  kind?: CitationKind;
  source?: CitationSource;
  /** Prefix the dimension icon (when the source names one). */
  withIcon?: boolean;
  className?: string;
}) {
  const label = kind === "wcag" && !/^WCAG/i.test(code) ? `WCAG ${code}` : code;
  const dim = source?.dimension ? DIMENSIONS[source.dimension as Dimension] : undefined;
  const w = kind === "wcag" ? wcagInfo(label) : null;

  return (
    <Popover.Root>
      <Popover.Trigger
        data-citation={label}
        aria-label={`${KIND_LABEL[kind]} ${label}: show source`}
        className={cn(
          "mono-id text-accent-soft border-line-strong hover:border-accent-soft data-popup-open:border-accent-soft inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 leading-none whitespace-nowrap transition-colors",
          className,
        )}
      >
        {withIcon && dim ? <dim.Icon aria-hidden className="size-3" strokeWidth={1.5} /> : null}
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className="bg-elevated text-fg border-line-strong shadow-pop w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border p-3 text-sm outline-none">
            <p className="mono-label text-fg-faint flex items-center gap-2">
              {KIND_LABEL[kind]}
              {source?.version ? <span>· v{source.version}</span> : null}
              {source?.neverSend ? (
                <span className="inline-flex items-center gap-1">
                  · <Lock aria-hidden className="size-3" /> never sent to AI
                </span>
              ) : null}
            </p>
            <Popover.Title className="flex items-baseline gap-2 text-base">
              <span className="mono-id text-accent-soft">{label}</span>
              <span>{w?.name ?? source?.title ?? ""}</span>
            </Popover.Title>
            {kind === "wcag" ? (
              <Popover.Description className="text-fg-muted">
                Web Content Accessibility Guidelines 2.2, level AA. Checked deterministically by
                BrandLens.
              </Popover.Description>
            ) : source?.body && !source.summaryView ? (
              <Popover.Description className="text-fg-muted max-h-48 overflow-y-auto whitespace-pre-line">
                {source.body}
              </Popover.Description>
            ) : source?.summary ? (
              <Popover.Description className="text-fg-muted">{source.summary}</Popover.Description>
            ) : (
              <Popover.Description className="text-fg-muted">
                Cited by this finding. Open the vault for the full text.
              </Popover.Description>
            )}
            {source?.summaryView ? <p className="mono-label text-fg-faint">Summary view</p> : null}
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {kind === "wcag" && w ? (
                <a
                  href={w.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-soft inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  Understanding {w.num} <ExternalLink aria-hidden className="size-3" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
              {source?.href ? (
                <Link
                  href={source.href}
                  className="text-accent-soft underline-offset-4 hover:underline"
                >
                  Open {kind === "fact" ? "fact" : "rule card"} →
                </Link>
              ) : null}
              {source?.sourcePage ? (
                <span className="text-fg-faint font-mono">guide p.{source.sourcePage}</span>
              ) : null}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Non-interactive code label, for rows that already *are* the rule or fact (vault lists). */
export function IdCode({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "mono-id text-accent-soft border-line-strong inline-flex h-6 items-center rounded-sm border px-1.5 leading-none whitespace-nowrap",
        className,
      )}
    >
      {code}
    </span>
  );
}
