"use client";

import { Suspense, type ReactNode } from "react";
import { AccountMenu, type AccountInfo } from "@/components/shell/account-menu";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { CrumbProvider } from "@/components/shell/crumbs";
import { DemoRoleList, DemoStrip } from "@/components/shell/demo-strip";
import { FlashToast } from "@/components/shell/flash-toast";
import { Shortcuts } from "@/components/shell/shortcuts";
import { TopBar } from "@/components/shell/top-bar";
import type { NavGroup } from "@/lib/workflow/permissions";

export type ShellProps = {
  account: AccountInfo;
  groups: NavGroup[];
  queueCount: number | null;
  activeRuns: { count: number; href: string | null };
  collapsed: boolean;
  demo: boolean;
  canCreate: boolean;
  canVault: boolean;
  reviewer: boolean;
  flash: string | null;
};

/** App shell (DESIGN.md §6.0): demo strip, sidebar (sheet below lg), top bar, ⌘K, shortcuts. */
export function AppShell({ children, ...p }: ShellProps & { children: ReactNode }) {
  const demoSlot = p.demo ? <DemoRoleList currentEmail={p.account.email} /> : undefined;
  const sidebar = (opts: { mobile?: boolean; onNavigate?: () => void }) => (
    <Suspense>
      <AppSidebar
        groups={p.groups}
        workspace={(collapsed) => (
          <AccountMenu account={p.account} collapsed={collapsed} demoSlot={demoSlot} />
        )}
        queueCount={p.queueCount}
        initialCollapsed={p.collapsed}
        {...opts}
      />
    </Suspense>
  );

  return (
    <CrumbProvider>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="bg-accent text-accent-fg sr-only z-[60] rounded-sm px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        {p.demo ? (
          <DemoStrip
            orgName={p.account.orgName}
            roleLabel={p.account.roleLabel}
            currentEmail={p.account.email}
          />
        ) : null}
        <div className="flex flex-1">
          <div className="sticky top-0 hidden h-dvh self-start lg:block">{sidebar({})}</div>
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              canCreate={p.canCreate}
              activeRuns={p.activeRuns}
              avatar={<AccountMenu account={p.account} variant="avatar" demoSlot={demoSlot} />}
              mobileNav={(close) => sidebar({ mobile: true, onNavigate: close })}
            />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
      <CommandPalette
        canVault={p.canVault}
        canCreate={p.canCreate}
        reviewer={p.reviewer}
        demo={p.demo}
      />
      <Shortcuts />
      <FlashToast message={p.flash} />
    </CrumbProvider>
  );
}
