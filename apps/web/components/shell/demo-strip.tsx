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
      <p className="label text-fg-muted mb-2 font-semibold">Switch demo role</p>
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
                  "flex w-full flex-col items-start rounded-sm border-2 px-2 py-1.5 text-left transition-colors",
                  current
                    ? "bg-highlight text-highlight-fg border-outline cursor-default"
                    : "hover:bg-hover border-transparent",
                )}
              >
                <span className="text-sm font-semibold">
                  {u.label}
                  {current ? <span className="font-normal"> · current</span> : null}
                </span>
                <span className={cn("text-xs", current ? "" : "text-fg-muted")}>
                  {DEMO_ROLE_BLURB[u.key]}
                </span>
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
    <div className="bg-band-pink text-fg border-outline flex h-9 shrink-0 items-center gap-2 border-b-2 px-4 text-sm">
      <span className="font-bold">Demo</span>
      <span aria-hidden className="text-fg-faint">
        ·
      </span>
      <span className="truncate">
        {orgName} (fictional) · {roleLabel}
      </span>
      <Popover.Root>
        <Popover.Trigger className="text-fg hover:bg-elevated ml-auto inline-flex h-7 items-center gap-1 rounded-sm px-2 font-semibold underline underline-offset-4">
          Switch role <ChevronDown aria-hidden className="size-3" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="end" className="z-50">
            <Popover.Popup className="bg-elevated border-outline w-80 rounded-[8px] border-2 p-3 outline-none">
              <DemoRoleList currentEmail={currentEmail} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
