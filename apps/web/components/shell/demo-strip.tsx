"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import { DEMO_ROLE_BLURB } from "@/lib/auth/demo-roles";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { signInAsDemo } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** The six demo roles as explicit submit buttons (no change-on-select, WCAG 3.2.2). */
export function DemoRoleList({ currentEmail }: { currentEmail?: string }) {
  return (
    <form action={signInAsDemo}>
      <p className="mono-label text-fg-faint mb-1.5">Switch demo role</p>
      <ul className="space-y-0.5">
        {DEMO_USERS.map((u) => {
          const current = u.email === currentEmail;
          return (
            <li key={u.key}>
              <button
                type="submit"
                name="user"
                value={u.key}
                disabled={current}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors",
                  current ? "bg-accent-deep cursor-default" : "hover:bg-hover",
                )}
              >
                <span className="text-fg text-sm">
                  {u.label}
                  {current ? <span className="text-fg-faint"> · current</span> : null}
                </span>
                <span className="text-fg-muted text-xs">{DEMO_ROLE_BLURB[u.key]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </form>
  );
}

/** Demo strip (DESIGN.md §7.2): `DEMO · PayWise (fictional) · signed in as Creator · Switch role ▾`. */
export function DemoStrip({
  orgName,
  roleLabel,
  currentEmail,
}: {
  orgName: string;
  roleLabel: string;
  currentEmail: string;
}) {
  return (
    <div className="bg-accent-deep text-fg mono-label flex h-8 shrink-0 items-center gap-2 px-4">
      <span className="text-accent-soft">DEMO</span>
      <span aria-hidden className="text-fg-faint">
        ·
      </span>
      <span className="text-fg-muted truncate tracking-normal normal-case">
        {orgName} (fictional) · signed in as {roleLabel}
      </span>
      <Popover.Root>
        <Popover.Trigger className="text-accent-soft hover:text-fg ml-auto inline-flex h-7 items-center gap-1 rounded-sm px-1.5">
          Switch role <ChevronDown aria-hidden className="size-3" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="end" className="z-50">
            <Popover.Popup className="bg-elevated border-line-strong shadow-pop w-80 rounded-md border p-2 outline-none">
              <DemoRoleList currentEmail={currentEmail} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
