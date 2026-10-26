"use client";

import { FindingCard, type FindingView } from "@/components/drafts/finding-card";

/** Read-only finding cards for reviewers (DESIGN.md §6.5). */
export function ReviewFindings({
  findings,
  summaryView,
}: {
  findings: FindingView[];
  summaryView: boolean;
}) {
  const noop = async () => {};
  if (!findings.length)
    return <p className="text-fg-muted text-sm">No findings on this version.</p>;
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <FindingCard
          key={f.id}
          index={i}
          finding={f}
          active={false}
          canAct={false}
          summaryView={summaryView}
          onFocus={() => {}}
          onApply={noop}
          onResolve={noop}
        />
      ))}
    </ul>
  );
}
