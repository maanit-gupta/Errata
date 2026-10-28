"use client";

import { Tabs } from "@base-ui/react/tabs";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedTab = {
  value: string;
  label: string;
  count?: number;
  /** URL-synced tabs navigate; omit for local state. */
  href?: string;
};

/**
 * SegmentedTabs (DESIGN.md §7.8): an ink-outlined control; active = solid ink + white text.
 * Arrow keys move focus, Enter/Space activates (manual activation, so URL tabs don't navigate on
 * every arrow press). The active panel wraps `children`.
 */
export function SegmentedTabs({
  tabs,
  value,
  onValueChange,
  label,
  children,
  className,
}: {
  tabs: SegmentedTab[];
  value: string;
  onValueChange?: (value: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(v) => onValueChange?.(String(v))}
      className={className}
    >
      <Tabs.List
        aria-label={label}
        className="border-outline bg-elevated inline-flex max-w-full gap-1 overflow-x-auto rounded-sm border-2 p-1"
      >
        {tabs.map((t) => {
          const text = (
            <>
              {t.label}
              {t.count != null ? (
                <span className="font-mono text-[0.75rem] font-medium">{t.count}</span>
              ) : null}
            </>
          );
          const cls = cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-100",
            "text-fg hover:bg-hover",
            "data-active:bg-accent data-active:text-accent-fg data-active:hover:bg-accent",
          );
          return t.href ? (
            <Tabs.Tab
              key={t.value}
              value={t.value}
              nativeButton={false}
              render={<Link href={t.href} scroll={false} />}
              className={cls}
            >
              {text}
            </Tabs.Tab>
          ) : (
            <Tabs.Tab key={t.value} value={t.value} className={cls}>
              {text}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      <Tabs.Panel
        value={value}
        className="mt-6 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus) focus-visible:outline-solid"
      >
        {children}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
