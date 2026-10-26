"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { PLAN_URL, REPO } from "@/components/marketing/links";

const CHECKS = ["Tone", "Terms", "Facts", "Claims", "Visual", "Accessibility"];
const WORKFLOW = [
  "Intent capture",
  "Risk routing",
  "Version diff",
  "Audit trail",
  "Guideline Clarity Score",
];

const linkCls =
  "inline-flex h-9 items-center gap-1 px-2 text-sm text-fg-muted transition-colors duration-[80ms] hover:bg-accent hover:text-accent-fg";

function NewTag() {
  return (
    <span className="mono-label border-mint text-mint ml-2 border px-1 text-[0.625rem]">NEW</span>
  );
}

/** Sticky marketing nav (DESIGN.md §8.2) with the Product mega-menu. */
export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-line bg-canvas/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-stretch pl-4 sm:pl-6">
        <Link href="/" className="mr-6 inline-flex items-center" aria-label="BrandLens home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <Popover.Root>
            <Popover.Trigger
              openOnHover
              delay={80}
              className={`${linkCls} data-popup-open:bg-accent data-popup-open:text-accent-fg`}
            >
              Product <ChevronDown aria-hidden className="size-3.5" />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={12} align="start" className="z-50">
                <Popover.Popup className="bg-elevated border-line-strong grid w-[34rem] grid-cols-2 gap-px border outline-none">
                  <Popover.Title className="sr-only">Product</Popover.Title>
                  <div className="bg-elevated p-5">
                    <p className="mono-label text-fg-faint">Checks</p>
                    <Link
                      href="#checks"
                      className="text-fg mt-1 mb-3 inline-flex items-center gap-1 text-lg hover:underline"
                    >
                      Six check dimensions <ChevronRight aria-hidden className="size-4" />
                    </Link>
                    <ul className="text-fg-muted space-y-1.5 text-sm">
                      {CHECKS.map((c) => (
                        <li key={c}>
                          {c}
                          {c === "Visual" ? <NewTag /> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-elevated border-line border-l p-5">
                    <p className="mono-label text-fg-faint">Review</p>
                    <Link
                      href="#how-it-works"
                      className="text-fg mt-1 mb-3 inline-flex items-center gap-1 text-lg hover:underline"
                    >
                      Workflow <ChevronRight aria-hidden className="size-4" />
                    </Link>
                    <ul className="text-fg-muted space-y-1.5 text-sm">
                      {WORKFLOW.map((c) => (
                        <li key={c}>
                          {c}
                          {c === "Guideline Clarity Score" ? <NewTag /> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <a href="#how-it-works" className={linkCls}>
            How it works
          </a>
          <a href="#responsible" className={linkCls}>
            Responsible AI
          </a>
          <a href="#insights" className={linkCls}>
            Insights
          </a>
          <a href={REPO} target="_blank" rel="noreferrer" className={linkCls}>
            GitHub ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
        <div className="ml-auto flex items-stretch">
          <a
            href={PLAN_URL}
            target="_blank"
            rel="noreferrer"
            className={`${linkCls} hidden self-center lg:inline-flex`}
          >
            Read the plan<span className="sr-only"> (PDF, opens in a new tab)</span>
          </a>
          <Link
            href={signedIn ? "/drafts" : "/login"}
            className="bg-fg text-canvas hover:bg-accent hover:text-accent-fg relative ml-3 inline-flex items-center gap-1 px-5 text-sm font-medium transition-colors duration-200 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-(--accent)"
          >
            Open app <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
