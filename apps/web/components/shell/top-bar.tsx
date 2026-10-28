"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { useCrumbLabel } from "@/components/shell/crumbs";
import { NAV_ICONS } from "@/components/shell/nav-icons";
import { buttonVariants } from "@/components/ui/button";
import type { NavIcon } from "@/lib/workflow/permissions";

const SECTIONS: Record<string, { label: string; icon: NavIcon; href: string }> = {
  drafts: { label: "Drafts", icon: "drafts", href: "/drafts" },
  review: { label: "Review queue", icon: "review", href: "/review" },
  vault: { label: "Brand vault", icon: "rules", href: "/vault" },
  insights: { label: "Insights", icon: "insights", href: "/insights" },
  audit: { label: "Audit log", icon: "audit", href: "/audit" },
  settings: { label: "Settings", icon: "settings", href: "/settings" },
};
const SUB: Record<string, string> = { new: "New draft", "ai-use": "Services & AI use" };

function Breadcrumb() {
  const pathname = usePathname();
  const custom = useCrumbLabel();
  const [first, second] = pathname.split("/").filter(Boolean);
  const section = first ? SECTIONS[first] : undefined;
  if (!section)
    return <span className="text-fg-muted text-sm">{first === "dev" ? "Dev preview" : ""}</span>;
  const Icon = NAV_ICONS[section.icon];
  const tail = second ? (SUB[second] ?? custom ?? "Item") : null;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[0.9375rem]">
        <li className="flex shrink-0 items-center gap-1.5">
          <Icon aria-hidden className="size-4" strokeWidth={2} />
          {tail ? (
            <Link
              href={section.href}
              className="text-fg-muted hover:text-fg underline-offset-4 hover:underline"
            >
              {section.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-semibold">
              {section.label}
            </span>
          )}
        </li>
        {tail ? (
          <>
            <li aria-hidden className="text-fg-faint">
              /
            </li>
            <li aria-current="page" className="truncate font-semibold">
              {tail}
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}

/**
 * Top bar (DESIGN.md §6.0): breadcrumb left; ⌘K search, + New draft, run indicator, help and
 * the avatar menu right. The menu button opens the sidebar as a sheet below `lg`.
 */
export function TopBar({
  canCreate,
  activeRuns,
  avatar,
  mobileNav,
}: {
  canCreate: boolean;
  activeRuns: { count: number; href: string | null };
  avatar: ReactNode;
  /** Sidebar contents for the mobile sheet; receives a close callback. */
  mobileNav: (close: () => void) => ReactNode;
}) {
  const [sheet, setSheet] = useState(false);
  return (
    <header className="border-outline bg-canvas sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b-2 px-4 sm:px-6 lg:px-8">
      <Dialog.Root open={sheet} onOpenChange={setSheet}>
        <Dialog.Trigger
          aria-label="Open menu"
          className="text-fg hover:bg-hover border-outline -ml-1 inline-flex size-10 items-center justify-center rounded-sm border-2 lg:hidden"
        >
          <Menu aria-hidden className="size-5" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="bg-overlay fixed inset-0 z-40" />
          <Dialog.Popup className="fixed inset-y-0 left-0 z-50 outline-none">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            {mobileNav(() => setSheet(false))}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Suspense>
        <Breadcrumb />
      </Suspense>

      <div className="ml-auto flex items-center gap-2">
        {activeRuns.count > 0 ? (
          <Link
            href={activeRuns.href ?? "/drafts"}
            className="text-fg hover:bg-hover hidden h-10 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold sm:inline-flex"
          >
            <LoaderCircle aria-hidden className="spin size-3.5" />
            {activeRuns.count} check{activeRuns.count === 1 ? "" : "s"} running
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("bl-palette"))}
          className="border-outline text-fg hover:bg-hover inline-flex h-10 items-center gap-2 rounded-sm border-2 px-3 text-sm"
        >
          <Search aria-hidden className="size-3.5" />
          <span className="hidden md:inline">Search</span>
          <kbd className="mono-id text-fg-muted bg-hover hidden rounded-sm px-1 md:inline">⌘K</kbd>
          <span className="sr-only md:hidden">Search</span>
        </button>
        {canCreate ? (
          <Link href="/drafts/new" className={buttonVariants({ variant: "primary" })}>
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">New draft</span>
            <span className="sr-only sm:hidden">New draft</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("bl-shortcuts"))}
          aria-label="Keyboard shortcuts and help"
          className="border-outline text-fg hover:bg-hover inline-flex size-10 items-center justify-center rounded-sm border-2 font-bold"
        >
          ?
        </button>
        {avatar}
      </div>
    </header>
  );
}
