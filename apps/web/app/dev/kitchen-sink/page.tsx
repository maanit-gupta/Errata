import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfidenceChip } from "@/components/brand/confidence-chip";
import { DegradedBanner } from "@/components/brand/degraded-banner";
import { DimensionLabel, DIMENSIONS } from "@/components/brand/dimension";
import { EmptyState } from "@/components/brand/empty-state";
import { ErrorPanel } from "@/components/brand/error-panel";
import { Forbidden } from "@/components/brand/forbidden";
import { IdBadge, IdCode } from "@/components/brand/id-badge";
import { IllustrativeDataPill } from "@/components/brand/illustrative-pill";
import { IntentCheckTag } from "@/components/brand/intent-check-tag";
import { KpiTile } from "@/components/brand/kpi-tile";
import { PageHeader } from "@/components/brand/page-header";
import { GLYPH_NAMES, PixelGlyph } from "@/components/brand/pixel-glyphs";
import { RiskMeter } from "@/components/brand/risk-meter";
import { RunPanel } from "@/components/brand/run-panel";
import { SeverityBadge } from "@/components/brand/severity-badge";
import { SourceTag } from "@/components/brand/source-tag";
import { Spinner } from "@/components/brand/spinner";
import { STATE_LABELS, StateBadge, type ContentState } from "@/components/brand/state-badge";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { WordCounter } from "@/components/brand/word-counter";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TOKEN_NAMES } from "@/lib/design/tokens";
import { DrawerDemo, FindingCardsDemo, TableDemo, TabsDemo, ToastDemo } from "./interactive";

export const metadata = { title: "Kitchen sink" };

const CL03 = {
  title: "No guaranteed or assured return language",
  summary: "Never promise or imply guaranteed returns on market-linked products.",
  body: "Mutual fund and SIP copy must not use “guaranteed”, “assured” or “risk-free” with returns. Cite historical performance with the F-112 disclaimer instead.",
  version: 2,
  sourcePage: 3,
  dimension: "claims",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-line space-y-3 border-t pt-5">
      <h2 className="mono-label text-fg-faint">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function Showcase({ theme }: { theme: "dark" | "light" }) {
  return (
    <div data-theme={theme} className="bg-canvas text-fg space-y-8 p-6">
      <p className="mono-label text-accent-soft">{theme} theme</p>

      <Section title="Tokens">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {TOKEN_NAMES.map((t) => (
            <li key={t} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="border-line-strong size-5 rounded-sm border"
                style={{ background: `var(--${t})` }}
              />
              <span className="mono-id text-fg-muted">--{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <p className="text-[2rem] leading-tight tracking-[-0.015em]">Page title, 32px / 400</p>
        <p className="text-xl">Card H3, 20px</p>
        <p className="text-sm">
          Body 15px. Plain, short, active voice. Name the rule ID instead of saying on-brand.
        </p>
        <p className="mono-label text-fg-faint">Mono label · eyebrow</p>
        <p className="mono-id">CL-03 · F-112 · WCAG 1.4.3 · review@1</p>
        <p className="font-mono text-[0.78125rem]">[03 filters] 4 findings · 18ms</p>
        <p className="text-gradient-word text-3xl font-light">gradient word (large text only)</p>
      </Section>

      <Section title="Brand marks and glyphs">
        <Row>
          <Wordmark />
          <ThemeToggle />
        </Row>
        <Row>
          {GLYPH_NAMES.map((g) => (
            <span key={g} className="flex flex-col items-center gap-1">
              <PixelGlyph name={g} size={32} />
              <span className="mono-id text-fg-faint text-[0.6875rem]">{g}</span>
            </span>
          ))}
        </Row>
      </Section>

      <Section title="Buttons">
        <Row>
          <Button>Submit for check</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Archive</Button>
          <Button variant="link">Open rule card →</Button>
          <Button disabled focusableWhenDisabled aria-describedby={`why-${theme}`}>
            Accept
          </Button>
          <span id={`why-${theme}`} className="text-fg-muted text-xs">
            Blockers need a fix or a person: confidence 0.54
          </span>
          <Button disabled>
            <span aria-hidden className="spin inline-block">
              ⟳
            </span>{" "}
            Submitting…
          </Button>
        </Row>
        <Row>
          <label className="grid gap-1 text-sm">
            Audience
            <Input placeholder="e.g. first-time investors" />
          </label>
        </Row>
      </Section>

      <Section title="Severity, citations and finding meta">
        <Row>
          <SeverityBadge severity="blocker" />
          <SeverityBadge severity="warning" />
          <SeverityBadge severity="suggestion" />
        </Row>
        <Row>
          <span className="inline-flex items-center gap-1">
            <IdBadge code="CL-03" source={CL03} withIcon />
            <SeverityBadge severity="blocker" />
          </span>
          <IdBadge
            code="F-112"
            kind="fact"
            source={{
              title: "Flexi-Cap 3-yr historical CAGR",
              summary: "14.2% CAGR (Oct 2023–Oct 2026), past performance disclaimer required.",
            }}
          />
          <IdBadge
            code="E-19"
            kind="fact"
            source={{
              title: "Diwali SIP webinar",
              neverSend: true,
              summary: "Oct 28, 7 pm IST, online.",
            }}
          />
          <IdBadge code="1.4.3" kind="wcag" />
          <IdBadge
            code="TV-04"
            source={{
              title: "Warm, plain tone",
              summaryView: true,
              summary: "Sound like a helpful friend, not a bank.",
            }}
          />
          <IdCode code="G-07" />
        </Row>
        <Row>
          <ConfidenceChip confidence={1} source="deterministic" />
          <ConfidenceChip confidence={0.91} source="llm" samples={2} />
          <ConfidenceChip confidence={0.54} source="llm" />
          <SourceTag source="deterministic" />
          <SourceTag source="llm" />
          <IntentCheckTag score={0.91} />
        </Row>
        <IntentCheckTag dropped="The suggested rewrite changed your CTA." />
        <Row>
          {Object.keys(DIMENSIONS).map((d) => (
            <DimensionLabel key={d} dimension={d} />
          ))}
        </Row>
      </Section>

      <Section title="Content states">
        <Row>
          {(Object.keys(STATE_LABELS) as ContentState[]).map((s) => (
            <StateBadge key={s} state={s} routeTo="legal" />
          ))}
        </Row>
      </Section>

      <Section title="Risk, KPI, word counter">
        <Row>
          <RiskMeter score={0} />
          <RiskMeter score={14} />
          <RiskMeter score={28} blocker />
          <RiskMeter score={null} />
        </Row>
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiTile
            label="Avg. brand-fit score"
            value="82"
            delta="+6 vs last 30 days"
            sparkline={[70, 72, 75, 74, 78, 80, 82]}
          />
          <KpiTile label="Blockers caught this week" value="17" delta="4 context-bleed" />
        </div>
        <Row>
          <WordCounter count={1240} max={2000} />
          <WordCounter count={1850} max={2000} />
          <WordCounter count={2104} max={2000} />
          <IllustrativeDataPill />
        </Row>
      </Section>

      <Section title="Finding cards">
        <FindingCardsDemo />
      </Section>

      <Section title="Run panel">
        <RunPanel
          run={{
            id: "7f3c9a",
            status: "running",
            timings: { ingest: 12, protect: 4, filters: 18 },
          }}
        />
        <RunPanel
          run={{
            id: "7f3c9a",
            status: "done",
            provider: "groq",
            model: "openai/gpt-oss-120b",
            promptVersion: "review@2",
            findings: 6,
            piiRedacted: 2,
            timings: {
              ingest: 12,
              protect: 4,
              filters: 18,
              retrieve: 31,
              llm: 2900,
              llm_calls: 1,
              gate: { quote_not_found: 1, no_valid_citation: 1 },
              total: 3400,
            },
          }}
        />
        <RunPanel
          run={{
            id: "b21e04",
            status: "done",
            degraded: true,
            findings: 3,
            timings: { ingest: 10, protect: 3, filters: 22, retrieve: 28, llm: 0, total: 900 },
          }}
          banner={
            <DegradedBanner
              action={
                <Button size="sm" variant="secondary">
                  Re-run
                </Button>
              }
            />
          }
        />
        <RunPanel
          run={{
            id: "c0ffee",
            status: "failed",
            errorCode: "parse_failed",
            timings: { ingest: 40 },
          }}
        />
      </Section>

      <Section title="Tabs and table">
        <TabsDemo />
        <TableDemo />
      </Section>

      <Section title="States (§11)">
        <Spinner label="Loading drafts…" />
        <EmptyState
          glyph="shield-check"
          title="Check your first draft"
          action={<Button>+ New draft</Button>}
          headingLevel={3}
        >
          Paste a caption, upload a DOCX, image or PDF, say who it&apos;s for, and get findings that
          cite your brand rules.
        </EmptyState>
        <ErrorPanel title="Couldn't load findings" reference="run 7f3c9a · PGRST301" retryHref="#">
          The database didn&apos;t answer in time. Your draft is safe.
        </ErrorPanel>
        <Forbidden role="Agency" action="open the brand vault" />
        <DegradedBanner />
      </Section>

      <Section title="Toasts and drawer">
        <ToastDemo />
        <DrawerDemo />
      </Section>
    </div>
  );
}

/** Visual QA page and axe target for components (DESIGN.md §10). Not served in production. */
export default function KitchenSink() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main" className="min-h-dvh">
      <div className="p-6 pb-0">
        <PageHeader
          eyebrow="Dev · DESIGN.md §5"
          title="Kitchen sink"
          description="Every brand component, in both themes."
        />
      </div>
      <div className="grid xl:grid-cols-2">
        <Showcase theme="dark" />
        <Showcase theme="light" />
      </div>
    </main>
  );
}
