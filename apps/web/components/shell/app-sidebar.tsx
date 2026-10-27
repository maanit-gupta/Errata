"use client";

import { ArrowRight, GitBranch, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { NAV_ICONS } from "@/components/shell/nav-icons";
import { WorkerStatus } from "@/components/shell/worker-status";
import { SIDEBAR_COOKIE, TIPCARD_COOKIE, setPrefCookie } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/workflow/permissions";

const GITHUB_URL = "https://github.com/maanit-gupta/BrandLens";

function isActive(href: string, pathname: string, tab: string | null): boolean {
  const [path, query] = href.split("?");
  if (query) {
    const want = new URLSearchParams(query).get("tab");
    return pathname === path && (tab ?? "rules") === want;
  }
  if (path === "/settings") return pathname === "/settings";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export type BottomCard =
  { kind: "watchlist"; unclear: { code: string; gcs: number }[] } | { kind: "tips" } | null;

/**
 * Sidebar (DESIGN.md §6.0): 240px, collapsible to 56px icons (remembered in a cookie), nav groups
 * under mono eyebrows, role card at the bottom, status/GitHub/collapse footer.
 */
export function AppSidebar({
  groups,
  workspace,
  bottomCard,
  queueCount,
  initialCollapsed,
  onNavigate,
  mobile = false,
}: {
  groups: NavGroup[];
  workspace: (collapsed: boolean) => ReactNode;
  bottomCard: BottomCard;
  queueCount: number | null;
  initialCollapsed: boolean;
  /** Mobile sheet: close after navigating. */
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const [collapsed, setCollapsed] = useState(mobile ? false : initialCollapsed);
  const [cardHidden, setCardHidden] = useState(false);

  const toggle = () => {
    setCollapsed((c) => {
      setPrefCookie(SIDEBAR_COOKIE, c ? "open" : "collapsed");
      return !c;
    });
  };

  return (
    <div
      className={cn(
        "bg-elevated border-line flex h-full flex-col border-r transition-[width] duration-200",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div
        className={cn("flex h-14 shrink-0 items-center px-4", collapsed && "justify-center px-0")}
      >
        <Link
          href="/drafts"
          aria-label="BrandLens home"
          className="rounded-sm"
          onClick={onNavigate}
        >
          <Wordmark compact={collapsed} />
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="text-fg-muted hover:bg-hover ml-auto inline-flex size-8 items-center justify-center rounded-md"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <div className={cn("px-2", collapsed && "px-1.5")}>{workspace(collapsed)}</div>

      <nav aria-label="Main" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.label} className="mt-4 first:mt-0">
            <p className={cn("mono-label text-fg-faint mb-1 px-2", collapsed && "sr-only")}>
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.href, pathname, tab);
                const Icon = NAV_ICONS[item.icon];
                const count = item.icon === "review" ? queueCount : null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-[80ms]",
                        active
                          ? "bg-accent text-accent-fg"
                          : "text-fg-muted hover:bg-hover hover:text-fg",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
                      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
                        {item.label}
                      </span>
                      {count ? (
                        <span
                          className={cn(
                            "mono-id rounded-sm px-1 text-[0.6875rem]",
                            active ? "bg-accent-hover" : "bg-hover text-fg",
                            collapsed && "sr-only",
                          )}
                        >
                          {count}
                          <span className="sr-only"> waiting</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && bottomCard && !cardHidden ? (
        <aside
          aria-label={bottomCard.kind === "watchlist" ? "Guideline watchlist" : "Pre-check tips"}
          className="border-line bg-canvas relative mx-2 mb-2 rounded-md border p-3 text-xs"
        >
          <button
            type="button"
            aria-label="Dismiss card"
            onClick={() => {
              setCardHidden(true);
              setPrefCookie(TIPCARD_COOKIE, "hidden");
            }}
            className="text-fg-faint hover:text-fg absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-sm"
          >
            <X aria-hidden className="size-3.5" />
          </button>
          {bottomCard.kind === "watchlist" ? (
            <>
              <p className="text-fg pr-5 font-medium">
                Guideline watchlist: {bottomCard.unclear.length} rule
                {bottomCard.unclear.length === 1 ? "" : "s"} UNCLEAR
              </p>
              <ul className="mt-2 space-y-1">
                {bottomCard.unclear.slice(0, 3).map((r) => (
                  <li key={r.code} className="mono-id text-fg-muted flex items-center gap-2">
                    <span className="text-blocker">{r.code}</span> · GCS {r.gcs}
                    <span
                      aria-hidden
                      className="bg-line-strong ml-auto h-1 w-10 overflow-hidden rounded-full"
                    >
                      <span className="bg-success block h-full" style={{ width: `${r.gcs}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/insights"
                onClick={onNavigate}
                className="text-accent-soft mt-2 inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                Review examples <ArrowRight aria-hidden className="size-3" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-fg pr-5 font-medium">Pre-check tips</p>
              <ul className="text-fg-muted mt-1.5 list-disc space-y-1 pl-4">
                <li>Fill in all five intent fields: rewrites are checked against them.</li>
                <li>Every finding cites a rule or fact ID. Click it to read the source.</li>
              </ul>
              <Link
                href="/#how-it-works"
                className="text-accent-soft mt-2 inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                Learn more <ArrowRight aria-hidden className="size-3" />
              </Link>
            </>
          )}
        </aside>
      ) : null}

      <div
        className={cn(
          "border-line flex h-11 shrink-0 items-center gap-3 border-t px-3",
          collapsed && "h-auto flex-col justify-center gap-1 px-0 py-2",
        )}
      >
        <WorkerStatus compact={collapsed} />
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-fg-faint hover:text-fg inline-flex h-7 items-center gap-1 text-xs"
          aria-label="GitHub (opens in a new tab)"
        >
          <GitBranch aria-hidden className="size-3.5" />
          {collapsed ? null : "GitHub"}
        </a>
        {mobile ? null : (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className={cn(
              "text-fg-faint hover:text-fg hover:bg-hover inline-flex size-7 items-center justify-center rounded-sm",
              !collapsed && "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
