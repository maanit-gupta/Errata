"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Severity } from "@/components/brand/severity-badge";
import { Button } from "@/components/ui/button";
import type { PdfPageView } from "@/lib/drafts/pages";
import { cn } from "@/lib/utils";
import { ImageFindings, type ImageMarker } from "./image-findings";

export type PdfMarker = ImageMarker & { page: number };

const ORDER: Severity[] = ["blocker", "warning", "suggestion"];

/** Per-page counts of open findings, worst first: "1 blocker, 2 warnings". */
export function pageSummary(markers: PdfMarker[], page: number): string {
  const on = markers.filter((m) => m.page === page);
  if (!on.length) return "no findings";
  return ORDER.flatMap((s) => {
    const n = on.filter((m) => m.severity === s).length;
    return n ? [`${n} ${s}${n === 1 ? "" : "s"}`] : [];
  }).join(", ");
}

function worst(markers: PdfMarker[], page: number): Severity | null {
  return ORDER.find((s) => markers.some((m) => m.page === page && m.severity === s)) ?? null;
}

const DOT: Record<Severity, string> = {
  blocker: "bg-blocker text-blocker-fg",
  warning: "bg-warning-bg text-warning border-warning border",
  suggestion: "bg-hover text-suggestion",
};

/**
 * A PDF review surface (P12): a thumbnail rail of rendered pages, each labelled with its open
 * findings, and the selected page with numbered boxes (`ImageFindings`). Controlled (`page` +
 * `onPageChange`, `active` + `onFocus`) in the editor, where the findings list follows the page;
 * uncontrolled on the read-only review page, where a `#show-<finding id>` link jumps to the
 * finding's page and highlights its box.
 */
export function PdfFindings({
  title,
  pages,
  markers,
  page: controlledPage,
  onPageChange,
  active,
  onFocus,
}: {
  title: string;
  pages: PdfPageView[];
  markers: PdfMarker[];
  page?: number;
  onPageChange?: (page: number) => void;
  active?: string | null;
  onFocus?: (id: string | null, scroll?: boolean) => void;
}) {
  const [ownPage, setOwnPage] = useState(pages[0]?.n ?? 1);
  const [ownActive, setOwnActive] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const page = controlledPage ?? ownPage;
  const setPage = (n: number) => (onPageChange ? onPageChange(n) : setOwnPage(n));
  const current = pages.find((p) => p.n === page) ?? pages[0];
  const index = pages.indexOf(current);

  // Review page: "Show on page N" links set #show-<id>.
  useEffect(() => {
    if (onPageChange) return;
    const show = () => {
      const m = /^#show-(.+)$/.exec(window.location.hash);
      const marker = m && markers.find((x) => x.id === m[1]);
      if (!marker) return;
      setOwnPage(marker.page);
      setOwnActive(marker.id);
      canvas.current?.scrollIntoView({ block: "start" });
    };
    show();
    window.addEventListener("hashchange", show);
    return () => window.removeEventListener("hashchange", show);
  }, [markers, onPageChange]);

  if (!current) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <nav aria-label="Pages" className="min-w-0">
        <ol className="flex gap-2 overflow-x-auto pb-1 sm:max-h-[75vh] sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:pr-1">
          {pages.map((p) => {
            const sev = worst(markers, p.n);
            const count = markers.filter((m) => m.page === p.n).length;
            return (
              <li key={p.n} className="shrink-0">
                <button
                  type="button"
                  aria-current={p.n === page ? "page" : undefined}
                  onClick={() => setPage(p.n)}
                  className={cn(
                    "block w-24 rounded-md border-2 p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus) sm:w-full",
                    p.n === page ? "border-line-strong" : "hover:border-line border-transparent",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL */}
                  <img
                    src={p.src}
                    alt=""
                    loading="lazy"
                    width={p.width}
                    height={p.height}
                    className="border-line block h-auto w-full rounded-sm border"
                  />
                  <span className="sr-only">{`Page ${p.n}: ${pageSummary(markers, p.n)}`}</span>
                  <span
                    aria-hidden
                    className="mt-1 flex items-center justify-between gap-1 font-mono text-xs"
                  >
                    <span>p. {p.n}</span>
                    {sev ? (
                      <span
                        aria-hidden
                        className={cn(
                          "rounded-sm px-1 text-[0.65rem] leading-4 whitespace-nowrap uppercase",
                          DOT[sev],
                        )}
                      >
                        {count}
                        {sev.slice(0, 1)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={canvas} className="min-w-0 scroll-mt-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <p aria-live="polite" className="m-0">
            Page {current.n} of {pages.length}{" "}
            <span className="text-fg-muted">· {pageSummary(markers, current.n)}</span>
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={index <= 0}
              onClick={() => setPage(pages[index - 1].n)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={index >= pages.length - 1}
              onClick={() => setPage(pages[index + 1].n)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
        <ImageFindings
          key={current.n}
          src={current.src}
          alt={`${title}, page ${current.n} of ${pages.length}`}
          markers={markers.filter((m) => m.page === current.n)}
          active={onFocus ? active : ownActive}
          onFocus={onFocus ?? ((id) => setOwnActive(id))}
        />
      </div>
    </div>
  );
}
