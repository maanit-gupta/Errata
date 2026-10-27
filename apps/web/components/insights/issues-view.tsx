"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IssuesChart, type Issue } from "./issues-chart";

/**
 * Top recurring issues with a "View as table" toggle (DESIGN.md §6.7). In chart view the table
 * stays in the accessibility tree (visually hidden), so screen-reader users always get the
 * numbers; the toggle only changes what sighted users see.
 */
export function IssuesView({ issues }: { issues: Issue[] }) {
  const [table, setTable] = useState(false);
  return (
    <div className="max-w-4xl space-y-3">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={table}
        onClick={() => setTable((t) => !t)}
        className="-ml-2"
      >
        {table ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
        {table ? "View as chart" : "View as table"}
      </Button>
      {table ? null : <IssuesChart issues={issues} />}
      <table className={cn("w-full text-sm", table ? null : "sr-only")}>
        <caption className="text-fg-muted mb-2 text-left text-xs">
          Findings per cited rule, fact or WCAG criterion, last 30 days
        </caption>
        <thead className="text-left">
          <tr className="border-line border-b">
            <th scope="col" className="py-1 font-medium">
              Issue
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Findings
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.code} className="border-line border-b last:border-0">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                <span className="font-mono text-xs font-medium">{i.code}</span>{" "}
                <span className="text-fg-muted">{i.label}</span>
              </th>
              <td className="py-1 text-right tabular-nums">{i.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
