"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/brand/data-table";
import { FindingCard, type FindingView } from "@/components/drafts/finding-card";
import { Drawer } from "@/components/brand/drawer";
import { IdCode } from "@/components/brand/id-badge";
import { RiskMeter } from "@/components/brand/risk-meter";
import { SegmentedTabs } from "@/components/brand/segmented-tabs";
import { StateBadge, type ContentState } from "@/components/brand/state-badge";
import { Button } from "@/components/ui/button";

type Row = { id: string; title: string; state: ContentState; risk: number; campaign: string };
const ROWS: Row[] = [
  {
    id: "1",
    title: "Diwali SIP caption",
    state: "needs_revision",
    risk: 14,
    campaign: "Diwali SIP 2026",
  },
  {
    id: "2",
    title: "Webinar invite email",
    state: "in_review",
    risk: 6,
    campaign: "Investor webinar",
  },
  {
    id: "3",
    title: "Flexi-Cap deck",
    state: "specialist_review",
    risk: 22,
    campaign: "Diwali SIP 2026",
  },
  {
    id: "4",
    title: "Navratri recap post",
    state: "publish_ready",
    risk: 0,
    campaign: "Navratri Savings 2026",
  },
];

export function TabsDemo() {
  const [tab, setTab] = useState("all");
  return (
    <SegmentedTabs
      label="Draft filters"
      value={tab}
      onValueChange={setTab}
      tabs={[
        { value: "all", label: "All", count: 12 },
        { value: "revision", label: "Needs revision", count: 2 },
        { value: "review", label: "In review", count: 3 },
        { value: "ready", label: "Publish-ready", count: 1 },
      ]}
    >
      <p className="text-fg-muted text-sm">Panel for “{tab}”.</p>
    </SegmentedTabs>
  );
}

export function TableDemo() {
  return (
    <DataTable
      caption="Sample drafts"
      rows={ROWS}
      rowKey={(r) => r.id}
      initialSort={{ key: "risk", dir: "desc" }}
      columns={[
        {
          key: "title",
          header: "Title",
          rowHeader: true,
          sortValue: (r) => r.title,
          cell: (r) => (
            <a href="#" className="underline-offset-4 hover:underline focus-visible:underline">
              {r.title}
            </a>
          ),
        },
        {
          key: "campaign",
          header: "Campaign",
          cell: (r) => <span className="text-fg-muted">{r.campaign}</span>,
        },
        {
          key: "state",
          header: "State",
          cell: (r) => <StateBadge state={r.state} routeTo="legal" />,
        },
        {
          key: "risk",
          header: "Risk",
          sortValue: (r) => r.risk,
          cell: (r) => <RiskMeter score={r.risk} size="sm" blocker={r.risk > 20} />,
        },
      ]}
    />
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast.success("Saved", { description: "Rule card CL-03 v3 approved." })}
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.error("Couldn't reach the AI provider", {
            description: "Showing deterministic findings. Re-run in a minute.",
            duration: Infinity,
          })
        }
      >
        Error toast
      </Button>
    </div>
  );
}

export function DrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open drawer
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={<IdCode code="CL-03" />}
        title="Edit rule card"
        footer={<Button onClick={() => setOpen(false)}>Save</Button>}
      >
        <p className="text-fg-muted text-sm">
          560px right-side drawer. Esc closes; focus returns to the trigger.
        </p>
      </Drawer>
    </>
  );
}

const BASE: FindingView = {
  id: "f1",
  dimension: "claims",
  severity: "blocker",
  confidence: 1,
  source: "deterministic",
  quote: "lock in 14.2% assured annual returns",
  span: { start: 0, end: 10 },
  target: "text",
  box: null,
  explanation:
    "Presents a return as certain on a market-linked product. It also quotes F-112 without the required disclaimer.",
  rewrite: "earn returns linked to the market (Flexi-Cap 3-yr historical CAGR 14.2%*)",
  status: "open",
  dismiss_reason: null,
  citations: [
    {
      code: "CL-03",
      kind: "rule",
      title: "No guaranteed or assured returns",
      text: "Never promise or imply guaranteed returns.",
    },
    { code: "F-112", kind: "fact", text: "Flexi-Cap 3-yr historical CAGR is 14.2% as of Q3 2026" },
  ],
};

export function FindingCardsDemo() {
  const noop = async () => {};
  const cards: FindingView[] = [
    BASE,
    {
      ...BASE,
      id: "f2",
      severity: "warning",
      dimension: "tone",
      source: "llm",
      confidence: 0.54,
      quote: "Don't miss out!!!",
      rewrite: null,
      model_version: "openai/gpt-oss-120b",
      prompt_version: "review@2",
      citations: [{ code: "TV-02", kind: "rule", title: "Warm, plain-spoken; no hype" }],
    },
    {
      ...BASE,
      id: "f3",
      severity: "warning",
      dimension: "terms",
      quote: "Paywise app",
      rewrite: "PayWise",
      status: "accepted",
      resolved_at: new Date().toISOString(),
      citations: [{ code: "G-07", kind: "rule", title: "Write PayWise, camel-cased" }],
    },
    {
      ...BASE,
      id: "f4",
      severity: "warning",
      dimension: "access",
      quote: "Register now",
      rewrite: null,
      status: "dismissed",
      dismiss_reason: "doesnt_apply",
      citations: [{ code: "WCAG 1.4.3", kind: "wcag" }],
    },
  ];
  return (
    <ul className="space-y-2">
      {cards.map((f, i) => (
        <FindingCard
          key={f.id}
          index={i}
          finding={f}
          active={false}
          canAct
          onFocus={() => {}}
          onApply={noop}
          onResolve={noop}
        />
      ))}
    </ul>
  );
}
