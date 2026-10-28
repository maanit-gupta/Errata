"use client";

import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { NAV_ICONS } from "@/components/shell/nav-icons";
import { SIDEBAR_COOKIE, setPrefCookie } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/workflow/permissions";

function isActive(href: string, pathname: string, tab: string | null): boolean {
  const [path, query] = href.split("?");
  if (query) {
    const want = new URLSearchParams(query).get("tab");
    return pathname === path && (tab ?? "rules") === want;
  }
  if (path === "/settings") return pathname === "/settings";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Sidebar (DESIGN.md §7.7): 256px, collapsible to 64px icons (remembered in a cookie), nav groups
 * under sans labels, yellow active item, collapse control at the bottom.
 */
export function AppSidebar({
  groups,
  workspace,
  queueCount,
  initialCollapsed,
  onNavigate,
  mobile = false,
}: {
  groups: NavGroup[];
  workspace: (collapsed: boolean) => ReactNode;
  queueCount: number | null;
  initialCollapsed: boolean;
  /** Mobile sheet: close after navigating. */
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const [collapsed, setCollapsed] = useState(mobile ? false : initialCollapsed);

  const toggle = () => {
    setCollapsed((c) => {
      setPrefCookie(SIDEBAR_COOKIE, c ? "open" : "collapsed");
      return !c;
    });
  };

  return (
    <div
      className={cn(
        "bg-elevated border-outline flex h-full flex-col border-r-2 transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn("flex h-16 shrink-0 items-center px-4", collapsed && "justify-center px-0")}
      >
        <Link href="/drafts" aria-label="Errata home" className="rounded-sm" onClick={onNavigate}>
          <Wordmark compact={collapsed} />
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="text-fg hover:bg-hover border-outline ml-auto inline-flex size-9 items-center justify-center rounded-sm border-2"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <div className={cn("px-3", collapsed && "px-2")}>{workspace(collapsed)}</div>

      <nav aria-label="Main" className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {groups.map((g) => (
          <div key={g.label} className="mt-5 first:mt-0">
            <p
              className={cn(
                "label text-fg-muted mb-1.5 px-2 font-semibold",
                collapsed && "sr-only",
              )}
            >
              {g.label}
            </p>
            <ul className="space-y-1">
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
                        "flex h-10 items-center gap-2.5 rounded-sm border-2 px-2 text-[0.9375rem] font-medium transition-colors duration-100",
                        active
                          ? "bg-highlight text-highlight-fg border-outline font-semibold"
                          : "text-fg hover:bg-hover border-transparent",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2} />
                      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
                        {item.label}
                      </span>
                      {count ? (
                        <span
                          className={cn(
                            "mono-id bg-accent text-accent-fg rounded-full px-1.5 text-[0.6875rem] leading-5",
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

      <div
        className={cn(
          "border-line flex h-12 shrink-0 items-center gap-3 border-t-2 px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {mobile ? null : (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className={cn(
              "text-fg hover:bg-hover inline-flex size-8 items-center justify-center rounded-sm",
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
