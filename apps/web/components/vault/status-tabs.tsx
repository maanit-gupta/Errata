"use client";

import type { ReactNode } from "react";
import { SegmentedTabs, type SegmentedTab } from "@/components/brand/segmented-tabs";

/** URL-synced status filter (server pages can't pass SegmentedTabs callbacks). */
export function StatusTabs(props: {
  label: string;
  value: string;
  tabs: SegmentedTab[];
  children: ReactNode;
}) {
  return <SegmentedTabs {...props} />;
}
