"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronsUpDown, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { WorkerStatus } from "@/components/shell/worker-status";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export type AccountInfo = {
  displayName: string;
  email: string;
  orgName: string;
  roleLabel: string;
};

/**
 * Workspace switcher / account popover (DESIGN.md §6.0): org, role chip, theme toggle, sign out,
 * and (demo mode) the role switcher slot. No billing: it's a WON'T item.
 */
export function AccountMenu({
  account,
  collapsed = false,
  variant = "workspace",
  demoSlot,
}: {
  account: AccountInfo;
  collapsed?: boolean;
  variant?: "workspace" | "avatar";
  demoSlot?: ReactNode;
}) {
  const initial = account.orgName.slice(0, 1).toUpperCase();
  const userInitial = account.displayName.slice(0, 1).toUpperCase();
  return (
    <Popover.Root>
      {variant === "workspace" ? (
        <Popover.Trigger
          className={cn(
            "hover:bg-hover data-popup-open:bg-hover border-outline flex h-12 w-full items-center gap-2 rounded-sm border-2 px-2 text-left text-sm transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            aria-hidden
            className="bg-band-pink text-fg border-outline flex size-8 shrink-0 items-center justify-center rounded-sm border-2 text-sm font-bold"
          >
            {initial}
          </span>
          <span className="sr-only">Workspace</span>
          {collapsed ? (
            <span className="sr-only">
              {account.orgName} {account.roleLabel}
            </span>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-semibold">{account.orgName}</span>
                <span data-testid="role-pill" className="label text-fg-muted truncate">
                  {account.roleLabel}
                </span>
              </span>
              <ChevronsUpDown aria-hidden className="size-4" />
            </>
          )}
        </Popover.Trigger>
      ) : (
        <Popover.Trigger className="bg-highlight text-highlight-fg border-outline hover:bg-hover hover:text-fg flex size-10 items-center justify-center rounded-full border-2 text-sm font-bold">
          <span aria-hidden>{userInitial}</span>
          <span className="sr-only">Account menu</span>
        </Popover.Trigger>
      )}
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={6}
          align={variant === "avatar" ? "end" : "start"}
          className="z-50"
        >
          <Popover.Popup className="bg-elevated border-outline w-72 space-y-3 rounded-[8px] border-2 p-4 text-sm outline-none">
            <div className="space-y-1">
              <Popover.Title className="text-fg font-bold">{account.displayName}</Popover.Title>
              <p className="text-fg-muted truncate text-xs">{account.email}</p>
              <p className="flex items-center gap-2 pt-1">
                <span className="text-fg-muted">{account.orgName}</span>
                <span className="label border-outline text-fg rounded-sm border-2 px-1.5 py-0.5 font-semibold">
                  {account.roleLabel}
                </span>
              </p>
            </div>
            {demoSlot ? <div className="border-line border-t-2 pt-3">{demoSlot}</div> : null}
            <div className="border-line flex items-center justify-between border-t-2 pt-3">
              <span className="text-fg-muted">Worker</span>
              <WorkerStatus />
            </div>
            <div className="border-line flex items-center justify-between border-t-2 pt-3">
              <span className="text-fg-muted">Theme</span>
              <ThemeToggle />
            </div>
            <form action={signOut} className="border-line border-t-2 pt-2">
              <button
                type="submit"
                className="text-fg hover:bg-hover flex h-10 w-full items-center gap-2 rounded-sm px-2 font-semibold"
              >
                <LogOut aria-hidden className="size-4" /> Sign out
              </button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
