"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

export type VersionOption = { n: number; href: string; at: string; latest?: boolean };

/**
 * Version switcher (DESIGN.md §6.3, §6.5): `v3 ▾` opens a menu of every version, newest first.
 * Each entry is a link, so it works with the keyboard, back button and middle-click.
 */
export function VersionSwitcher({
  versions,
  current,
  className,
}: {
  versions: VersionOption[];
  current: number;
  className?: string;
}) {
  if (versions.length < 2) {
    return <span className={cn("mono-id text-fg-faint", className)}>v{current}</span>;
  }
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`v${current}: switch version (${versions.length} versions)`}
        className={cn(
          "mono-id text-fg-muted hover:bg-hover hover:text-fg border-control inline-flex h-7 items-center gap-1 rounded-sm border px-2 text-xs",
          className,
        )}
      >
        v{current}
        <ChevronDown aria-hidden className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={4} align="start">
          <Menu.Popup className="bg-elevated border-line-strong shadow-pop min-w-52 rounded-md border p-1 outline-none">
            {versions.map((v) => (
              <Menu.Item
                key={v.n}
                render={<Link href={v.href} />}
                aria-current={v.n === current ? "page" : undefined}
                className="data-highlighted:bg-hover flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                <span className={cn("mono-id", v.n === current ? "text-accent-soft" : "text-fg")}>
                  v{v.n}
                </span>
                <span className="text-fg-muted flex-1 text-xs">
                  {new Date(v.at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
                {v.latest ? <span className="mono-label text-fg-faint">Latest</span> : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
