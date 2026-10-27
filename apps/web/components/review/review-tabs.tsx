"use client";

import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/brand/segmented-tabs";

/** Review page tabs (DESIGN.md §6.5): Findings · Diff · Comments · Audit. */
export function ReviewTabs({
  panels,
}: {
  panels: { value: string; label: string; count?: number; content: ReactNode }[];
}) {
  const [tab, setTab] = useState(panels[0].value);
  return (
    <SegmentedTabs
      label="Review details"
      value={tab}
      onValueChange={setTab}
      tabs={panels.map(({ value, label, count }) => ({ value, label, count }))}
    >
      {panels.find((p) => p.value === tab)?.content}
    </SegmentedTabs>
  );
}
