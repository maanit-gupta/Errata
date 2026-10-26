"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Issue = { code: string; label: string; dimension: string; n: number };

/**
 * "Top recurring issues": one series (findings per cited rule, fact or WCAG criterion), so one
 * hue and no legend. Bars are warm grey (vermilion is reserved for blockers); values are labelled
 * at the bar end in text ink; a hover tooltip names the rule. The chart is decorative for screen
 * readers: the same numbers are in the table next to it.
 */
export function IssuesChart({ issues }: { issues: Issue[] }) {
  const data = issues.map((i) => ({ ...i, name: i.code }));
  return (
    <div aria-hidden className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="name"
            width={72}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--foreground)", fontSize: 12, fontFamily: "var(--font-code)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as Issue) : null;
              return p ? (
                <div className="border-line bg-popover text-popover-foreground rounded-md border px-2 py-1 text-xs shadow-sm">
                  <p className="font-mono font-medium">{p.code}</p>
                  <p className="max-w-56">{p.label}</p>
                  <p className="text-fg-muted">
                    {p.n} finding{p.n === 1 ? "" : "s"} · {p.dimension}
                  </p>
                </div>
              ) : null;
            }}
          />
          <Bar dataKey="n" fill="var(--muted-foreground)" radius={[0, 4, 4, 0]} barSize={14}>
            <LabelList
              dataKey="n"
              position="right"
              style={{ fill: "var(--foreground)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
