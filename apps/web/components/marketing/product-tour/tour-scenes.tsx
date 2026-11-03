"use client";

import {
  ArrowRight,
  Check,
  Copy,
  FileText,
  Lock,
  Server,
  ShieldCheck,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { ErrataMark, TAGLINE } from "@/components/brand/wordmark";
import { AUTO_HEAL } from "@/lib/marketing/tour";
import { cn } from "@/lib/utils";
import { At, Count, FakeButton, Id, Panel, Sev, Typed, useTourTime } from "./tour-kit";

/**
 * The eight scenes of the landing-page product tour. Decorative (the player renders them inside an
 * aria-hidden canvas); the words a screen reader gets are TOUR_SCENES[i].summary. Times are ms
 * from the start of the scene; the player passes Infinity to show a scene finished.
 */

function Done({ children }: { children: ReactNode }) {
  return (
    <>
      <Check aria-hidden className="size-3.5" strokeWidth={3} />
      {children}
    </>
  );
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("label text-fg-muted mb-1.5", className)}>{children}</p>;
}

/* 1 ─ The hook, the rename and the problem */
function ProblemScene() {
  const { t } = useTourTime();
  const renamed = t >= 900;
  const stats = [
    {
      n: 77,
      suffix: "%",
      text: "see off-brand content at their company",
      src: "Marq, 2021",
      tone: "bg-elevated",
    },
    {
      n: 98,
      suffix: "%",
      text: "of ads ASCI scrutinised in FY 2024–25 needed a change",
      src: "ASCI",
      tone: "bg-highlight text-highlight-fg",
    },
    {
      n: 70,
      suffix: "%+",
      text: "of CMOs worry about GenAI and brand voice",
      src: "BCG, 2024",
      tone: "bg-band-pink",
    },
    {
      n: 79.1,
      suffix: "%",
      text: "of the top million home pages have low-contrast text",
      src: "WebAIM, 2025",
      tone: "bg-elevated",
      decimals: 1,
    },
  ];
  return (
    <div className="grid h-full gap-5 p-4 md:grid-cols-[1.15fr_1fr] md:p-6">
      <div className="flex min-w-0 flex-col justify-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "border-outline inline-flex h-7 items-center rounded-sm border-2 px-2 text-xs font-semibold transition-colors duration-300",
              renamed ? "bg-highlight text-highlight-fg" : "bg-elevated text-fg-muted",
            )}
          >
            {renamed ? "Now: Errata" : "Round 1: BrandLens"}
          </span>
          <At ms={900} as="span" className="text-fg-muted text-xs">
            renamed 29 Oct 2026
          </At>
        </div>
        <At ms={200}>
          <p className="text-[clamp(26px,3.4vw,40px)] leading-[1.05] font-semibold tracking-[-0.03em]">
            Every draft, checked before it ships.
          </p>
        </At>
        <At ms={1500} className="grid grid-cols-[auto_1fr] items-center gap-3 text-xs">
          <ul className="space-y-1.5">
            {[
              "Employees",
              "Agencies & freelancers",
              "AI writing & image tools",
              "Regional & social teams",
            ].map((s) => (
              <li
                key={s}
                className="border-outline bg-elevated rounded-sm border-2 px-2 py-1 font-semibold whitespace-nowrap"
              >
                {s}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <div className="border-blocker bg-blocker-bg flex items-start gap-2 rounded-sm border-2 px-2.5 py-2">
              <X aria-hidden className="text-blocker mt-0.5 size-4 shrink-0" strokeWidth={3} />
              <span>
                <b>Manual glance check</b>
                <span className="text-fg-muted block">
                  reads wording only · 3–4 rounds · 72–96 h
                </span>
              </span>
            </div>
            <At
              ms={2400}
              className="border-success bg-success-bg flex items-start gap-2 rounded-sm border-2 px-2.5 py-2"
            >
              <Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" strokeWidth={3} />
              <span>
                <b>Errata target</b>
                <span className="text-fg-muted block">about 2 h · 1–2 rounds</span>
              </span>
            </At>
          </div>
        </At>
      </div>
      <div className="grid grid-cols-2 gap-3 self-center">
        {stats.map((s, i) => (
          <At
            key={s.src}
            ms={3000 + i * 350}
            className={cn("border-outline flex flex-col gap-1 rounded-lg border-2 p-3", s.tone)}
          >
            <span className="font-mono text-[clamp(22px,2.6vw,32px)] leading-none font-semibold">
              <Count
                from={0}
                to={s.n}
                ms={3000 + i * 350}
                decimals={s.decimals ?? 0}
                suffix={s.suffix}
              />
            </span>
            <span className="text-[0.75rem] leading-snug">{s.text}</span>
            <span className="text-[0.625rem] opacity-80">{s.src}</span>
          </At>
        ))}
      </div>
    </div>
  );
}

/* 2 ─ One-click demo roles, vault import, MCP server */
function SetupScene() {
  const roles = ["Brand admin", "Creator", "Agency", "Manager", "Legal", "Accessibility"];
  const cards = [
    { id: "TV-02", dim: "Tone" },
    { id: "CL-03", dim: "Claims" },
    { id: "G-07", dim: "Terms" },
  ];
  return (
    <div className="grid h-full gap-3 p-3 md:grid-cols-[0.8fr_1.2fr_1fr] md:items-start md:p-4">
      <Panel title="/login · Try a demo role" className="hidden md:flex">
        <ul className="grid grid-cols-2 gap-1.5">
          {roles.map((r) => (
            <li key={r}>
              {r === "Brand admin" ? (
                <FakeButton
                  pressAt={900}
                  variant="outline"
                  className="h-auto w-full flex-col items-start py-1.5"
                >
                  <span>{r}</span>
                  <span className="text-fg-muted font-mono text-[0.5625rem] font-normal">
                    admin@paywise.demo
                  </span>
                </FakeButton>
              ) : (
                <span className="border-outline bg-elevated flex flex-col rounded-sm border-2 px-2.5 py-1.5 text-xs font-semibold">
                  {r}
                  <span className="text-fg-muted font-mono text-[0.5625rem] font-normal">
                    *@paywise.demo
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-fg-muted mt-2 text-[0.6875rem]">
          No password. Switch roles from the strip.
        </p>
      </Panel>

      <Panel title="Vault · import" tone="yellow">
        <div className="space-y-1.5 text-xs">
          {[
            { name: "PayWise_Brand_Guide.pdf", note: "also .docx or a URL", ms: 1200 },
            { name: "facts.csv", note: "Fact Vault", ms: 1600 },
          ].map((f) => (
            <At
              key={f.name}
              ms={f.ms}
              className="border-outline flex items-center gap-2 rounded-sm border-2 px-2 py-1.5"
            >
              <Upload aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate font-mono text-[0.6875rem]">{f.name}</span>
              <span className="text-fg-muted ml-auto shrink-0 text-[0.625rem]">{f.note}</span>
            </At>
          ))}
        </div>
        <Label className="mt-3">AI-drafted rule cards · waiting for a person</Label>
        <ul className="space-y-1.5">
          {cards.map((c, i) => (
            <At
              as="li"
              key={c.id}
              ms={2100 + i * 400}
              className="bg-band-pink border-outline flex items-center gap-2 rounded-sm border-2 px-2 py-1 text-xs"
            >
              <Id>{c.id}</Id>
              <span className="font-semibold">{c.dim}</span>
              <At
                as="span"
                ms={4300}
                className="text-success ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-semibold"
              >
                <Check aria-hidden className="size-3.5" strokeWidth={3} /> approved
              </At>
            </At>
          ))}
        </ul>
        <At ms={3200} className="mt-3">
          <FakeButton gate variant="ink" pressAt={4000} done={<Done>3 rule cards approved</Done>}>
            Approve 3 rule cards
          </FakeButton>
        </At>
      </Panel>

      <Panel
        title="MCP server · read-only"
        right={<span className="mono-id text-[0.625rem]">/v1/mcp</span>}
        className="hidden md:flex"
      >
        <div className="flex flex-col items-stretch gap-1.5 text-[0.6875rem]">
          <At
            ms={4500}
            className="bg-highlight text-highlight-fg border-outline rounded-sm border-2 px-2 py-1.5"
          >
            <b>Fact Vault + rule cards</b>
            <span className="block">approved · valid_until &gt; now() · top-k by campaign</span>
          </At>
          <At ms={4800} className="flex justify-center">
            <ArrowRight aria-hidden className="size-4 rotate-90" />
          </At>
          <At
            ms={4800}
            className="border-outline flex items-center gap-2 rounded-sm border-[3px] px-2 py-1.5"
          >
            <Server aria-hidden className="size-4 shrink-0" />
            <span>
              <b>Errata MCP server</b>
              <span className="text-fg-muted block">personal bl_mcp_ key</span>
            </span>
          </At>
          <At ms={5100} className="flex justify-center">
            <ArrowRight aria-hidden className="size-4 rotate-90" />
          </At>
          <At ms={5100} className="grid grid-cols-2 gap-1.5">
            {["Claude Code", "Cursor"].map((c) => (
              <span
                key={c}
                className="border-outline bg-elevated rounded-sm border-2 px-2 py-1 text-center font-semibold"
              >
                {c}
              </span>
            ))}
          </At>
          <At
            ms={5600}
            className="border-success bg-success-bg text-success mt-1 rounded-sm border-2 px-2 py-1 font-semibold"
          >
            20/20 real-stack calls · 0/3 never-send canaries leaked · agencies get facts only
          </At>
        </div>
      </Panel>
    </div>
  );
}

/* 3 ─ Intent first, then the draft */
function DraftScene() {
  const intent = [
    { k: "Goal", v: "webinar sign-ups", ms: 200 },
    { k: "Audience", v: "first-time investors", ms: 1000 },
    { k: "Call to action", v: "Register now", ms: 1800 },
  ];
  const formats = [
    "Plain text / Markdown",
    "HTML",
    "Word (.docx)",
    "Images (PNG, JPG, WebP)",
    "PDF decks",
  ];
  const hl = (kind: "blocker" | "warning") =>
    cn(
      "text-fg rounded-[2px] underline decoration-2 underline-offset-4",
      kind === "blocker"
        ? "bg-blocker-bg decoration-blocker"
        : "bg-warning-bg decoration-warning decoration-dashed",
    );
  const { t } = useTourTime();
  const mark = (ms: number, kind: "blocker" | "warning", text: string) =>
    t >= ms ? <mark className={hl(kind)}>{text}</mark> : <span>{text}</span>;
  return (
    <div className="grid h-full gap-3 p-3 md:grid-cols-[0.85fr_1.15fr] md:items-start md:p-4">
      <Panel title="editor / new draft · intent (required)" gate>
        <div className="space-y-2">
          {intent.map((f) => (
            <div key={f.k}>
              <Label className="mb-0.5">{f.k}</Label>
              <div className="border-outline bg-elevated flex h-8 items-center rounded-sm border-2 px-2 text-sm">
                <Typed text={f.v} ms={f.ms} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="border-line rounded-sm border-2 px-2 py-1">Channel: Instagram</span>
            <span className="border-line rounded-sm border-2 px-2 py-1">
              Campaign: Diwali SIP 2026
            </span>
          </div>
          <At ms={2600} className="max-md:hidden">
            <Label className="mt-2">Draft formats</Label>
            <ul className="flex flex-wrap gap-1">
              {formats.map((f) => (
                <li
                  key={f}
                  className="border-outline bg-code rounded-sm border-2 px-1.5 py-0.5 text-[0.625rem] font-semibold"
                >
                  {f}
                </li>
              ))}
            </ul>
          </At>
        </div>
      </Panel>
      <Panel
        title="Draft v2 · Instagram caption · Diwali SIP 2026"
        right={<FileText aria-hidden className="size-3.5" />}
      >
        <div className="bg-code rounded-sm p-3 text-[0.9375rem] leading-[1.8]">
          This Diwali, start a festive SIP on {mark(4500, "warning", "Paywise app")} with{" "}
          {mark(4800, "blocker", "0% exit load")} and lock in{" "}
          {mark(5100, "blocker", "14.2% assured annual returns")} — webinar registration closes{" "}
          {mark(5400, "blocker", "Oct 18 at Hall B, Chandigarh")}!
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FakeButton variant="ink" pressAt={3800} done={<Done>Submitted · checking</Done>}>
            Submit for check
          </FakeButton>
          <At as="span" ms={4500} className="text-fg-muted text-xs">
            4 spans flagged · solid = blocker, dashed = warning
          </At>
        </div>
      </Panel>
    </div>
  );
}

/* 4 ─ Six steps, two trust zones, the local intent check */
function PipelineScene() {
  const { t } = useTourTime();
  const local = [
    { n: "01", name: "Ingest", d: "PyMuPDF, python-docx spans and boxes; OCR on images" },
    { n: "02", name: "Protect", d: "Redact PII and secrets; drop never-send items" },
    { n: "03", name: "Filters", d: "Glossary, Fact Vault, claims, WCAG contrast, ΔE, logo. No AI" },
    { n: "04", name: "Retrieve", d: "bge-small (384-d) + pgvector top-k for the campaign" },
  ];
  const external = [
    {
      n: "05",
      name: "AI pass",
      d: "One structured call: tone, claims, fixes",
      tone: "bg-band-pink",
    },
    {
      n: "06",
      name: "Citation gate",
      d: "Drop flags without a retrieved ID or an exact quote",
      tone: "bg-highlight text-highlight-fg",
    },
  ];
  const active = t === Infinity ? 6 : Math.min(6, Math.floor(t / 650));
  const node = (s: { n: string; name: string; d: string; tone?: string }, i: number) => {
    const state = i < active ? "done" : i === active ? "now" : "todo";
    return (
      <li
        key={s.n}
        className={cn(
          "border-outline relative flex min-w-0 flex-col gap-0.5 rounded-sm p-2 text-[0.6875rem] transition-opacity duration-300",
          state === "now" ? "border-[3px]" : "border-2",
          s.tone ?? "bg-elevated",
          state === "todo" && "opacity-45",
        )}
      >
        <span className="flex items-center justify-between">
          <span className="font-mono font-semibold">{s.n}</span>
          {state === "done" ? (
            <Check aria-hidden className="text-success size-3.5" strokeWidth={3} />
          ) : null}
          {state === "now" ? (
            <span className="mono-id bg-accent text-accent-fg rounded-sm px-1 text-[0.5625rem]">
              v2
            </span>
          ) : null}
        </span>
        <b className="text-xs">{s.name}</b>
        <span className="leading-snug opacity-85 max-md:hidden">{s.d}</span>
      </li>
    );
  };
  const checks = [
    "Meaning kept: bge-small cosine ≥ 0.74 (calibrated)",
    "CTA “Register now” and campaign keywords kept",
    "Re-run through step 3: a fix can't break a rule",
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-3 md:p-4">
      <div className="grid gap-2 md:grid-cols-[2fr_auto_1fr]">
        <div className="bg-band-grey border-outline rounded-lg border-2 p-2">
          <p className="label mb-1.5 font-semibold">Inside the worker · local · reproducible</p>
          <ol className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {local.map((s, i) => node(s, i))}
          </ol>
        </div>
        <div className="flex items-center justify-center gap-1 md:flex-col">
          <Lock aria-hidden className="size-4" />
          <span className="border-outline h-0 w-16 border-t-2 border-dashed md:h-16 md:w-0 md:border-t-0 md:border-l-2" />
          <span className="label text-center text-[0.625rem] md:w-16">trust boundary</span>
        </div>
        <div className="border-outline rounded-lg border-2 border-dashed p-2">
          <p className="label mb-1.5 font-semibold">External AI · gated locally</p>
          <ol className="grid grid-cols-2 gap-1.5">{external.map((s, i) => node(s, i + 4))}</ol>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <At ms={4200}>
          <Panel
            title="Intent check on each suggested fix · local"
            right={<span className="mono-id text-[0.625rem]">&lt; 15 ms</span>}
          >
            <ul className="space-y-1.5 text-xs">
              {checks.map((c, i) => (
                <At as="li" key={c} ms={4500 + i * 400} className="flex items-center gap-2">
                  <Check aria-hidden className="text-success size-4 shrink-0" strokeWidth={3} />
                  {c}
                </At>
              ))}
            </ul>
          </Panel>
        </At>
        <At
          ms={5400}
          className="border-outline bg-elevated flex flex-col justify-center gap-1 rounded-lg border-2 p-3"
        >
          <span className="font-mono text-3xl leading-none font-semibold">
            ~<Count from={0} to={4.8} ms={5400} decimals={1} suffix=" ms" />
          </span>
          <span className="text-fg-muted text-xs">warm median, local embedding</span>
          <span className="text-success text-xs font-semibold">100% cited · 0 uncited shown</span>
        </At>
      </div>
    </div>
  );
}

/* 5 ─ Findings, visual auto-heal, cross-modal */
function FindingsScene() {
  const { t } = useTourTime();
  const healed = t >= 6600;
  return (
    <div className="grid h-full gap-3 p-3 md:grid-cols-[1.35fr_1fr] md:p-4">
      <Panel
        title="findings · 4"
        right={
          <span className="text-[0.625rem] font-normal">
            below 0.6 confidence: no one-click accept
          </span>
        }
      >
        <ol className="space-y-2">
          <At as="li" ms={200} className="border-outline rounded-sm border-2 p-2">
            <div className="flex flex-wrap items-center gap-1">
              <Sev level="blocker" />
              <Id>CL-03</Id>
              <Id>F-112</Id>
              <span className="text-xs font-semibold">Unsupported claim</span>
              <span className="text-fg-muted ml-auto font-mono text-[0.625rem]">conf 0.96</span>
            </div>
            <p className="mt-1 text-[0.6875rem] leading-snug max-md:hidden">
              <q className="font-mono">14.2% assured annual returns</q> presents a historical figure
              as a guarantee. Fix:{" "}
              <span className="bg-success-bg">
                3-yr historical CAGR 14.2% (Q3 2026) + MF disclaimer
              </span>
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <FakeButton className="h-6 text-[0.6875rem]">Accept fix</FakeButton>
              <FakeButton
                gate
                pressAt={2600}
                done={<Done>Routed to Legal</Done>}
                className="h-6 text-[0.6875rem]"
              >
                Route to Legal
              </FakeButton>
            </div>
          </At>
          <At as="li" ms={500} className="border-outline rounded-sm border-2 p-2">
            <div className="flex flex-wrap items-center gap-1">
              <Sev level="blocker" />
              <Id>F-048</Id>
              <Id>E-19</Id>
              <span className="text-xs font-semibold">Fact from another campaign</span>
              <span className="text-fg-muted ml-auto font-mono text-[0.625rem]">
                deterministic · 1.00
              </span>
            </div>
            <p className="mt-1 text-[0.6875rem] leading-snug max-md:hidden">
              <q className="font-mono">0% exit load</q> ·{" "}
              <q className="font-mono">Oct 18 at Hall B</q> vs 1% exit load; online, Oct 28, 7:00 PM
              IST.
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <FakeButton
                gate
                pressAt={3800}
                done={<Done>fix accepted</Done>}
                className="h-6 text-[0.6875rem]"
              >
                Accept fix
              </FakeButton>
            </div>
          </At>
          <At
            as="li"
            ms={800}
            className="border-outline flex flex-wrap items-center gap-1.5 rounded-sm border-2 p-2"
          >
            <Sev level="warning" />
            <Id>G-07</Id>
            <span className="text-[0.6875rem]">
              <q className="font-mono">Paywise app</q> → <b>PayWise</b>
            </span>
            <FakeButton
              gate
              pressAt={4900}
              done={<Done>fix accepted</Done>}
              className="ml-auto h-6 text-[0.6875rem]"
            >
              Accept fix
            </FakeButton>
          </At>
          <At
            as="li"
            ms={1100}
            className="border-outline flex flex-wrap items-center gap-1.5 rounded-sm border-2 p-2"
          >
            <Sev level="warning" />
            <Id>WCAG 1.4.3</Id>
            <span className="text-[0.6875rem]">
              Poster text <b className="font-mono">2.89 : 1</b>; large text needs 3 : 1
            </span>
          </At>
        </ol>
        <At
          ms={1400}
          className="text-fg-muted mt-2 flex flex-wrap gap-1.5 text-[0.625rem] max-md:hidden"
        >
          <span>Accept fix</span>·<span>Edit</span>·
          <span>Dismiss with a reason: approved exception, doesn&apos;t apply, AI is wrong</span>·
          <span>Route</span>
        </At>
      </Panel>

      <div className="hidden min-w-0 flex-col gap-3 md:flex">
        <At ms={5600}>
          <Panel title="Visual auto-heal" tone="yellow">
            <div className="flex items-center gap-2 text-[0.6875rem]">
              <span className="border-outline flex flex-1 flex-col items-center gap-1 rounded-sm border-2 p-1.5">
                <span
                  aria-hidden
                  className="h-6 w-full rounded-[2px]"
                  style={{ backgroundColor: AUTO_HEAL.flagged.hex }}
                />
                <span className="font-mono">
                  {AUTO_HEAL.flagged.hex} · {AUTO_HEAL.flagged.ratio}:1
                </span>
                <span className="text-blocker font-semibold">Fails AA</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0" />
              <span
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-sm p-1.5 transition-colors duration-300",
                  healed ? "border-success border-[3px]" : "border-outline border-2",
                )}
              >
                <span
                  aria-hidden
                  className="h-6 w-full rounded-[2px]"
                  style={{ backgroundColor: AUTO_HEAL.palette.hex }}
                />
                <span className="font-mono">
                  {AUTO_HEAL.palette.hex} · {AUTO_HEAL.palette.ratio}:1
                </span>
                <span className="text-success font-semibold">
                  {AUTO_HEAL.palette.name} · AA pass
                </span>
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              <FakeButton className="h-6 text-[0.6875rem]">
                <Copy aria-hidden className="size-3" />
                Copy CSS fix
              </FakeButton>
              <FakeButton gate className="h-6 text-[0.6875rem]">
                Accept (creator decides)
              </FakeButton>
            </div>
          </Panel>
        </At>
        <At ms={6800}>
          <Panel title="Cross-modal check" right={<Id>E-19</Id>}>
            <ul className="space-y-1 text-[0.6875rem]">
              {[
                { src: "Image banner (OCR)", v: "Oct 28 · 7 PM", ok: true },
                { src: "Social caption", v: "Oct 28 · 7:00 PM IST", ok: true },
                { src: "Landing page", v: "Oct 18 · Hall B", ok: false },
              ].map((r, i) => (
                <At as="li" key={r.src} ms={7100 + i * 300} className="flex items-center gap-2">
                  {r.ok ? (
                    <Check aria-hidden className="text-success size-3.5 shrink-0" strokeWidth={3} />
                  ) : (
                    <X aria-hidden className="text-blocker size-3.5 shrink-0" strokeWidth={3} />
                  )}
                  <span className="w-28 shrink-0">{r.src}</span>
                  <span className={cn("font-mono", !r.ok && "text-blocker font-semibold")}>
                    {r.v}
                  </span>
                </At>
              ))}
            </ul>
          </Panel>
        </At>
      </div>
    </div>
  );
}

/* 6 ─ States, routing, Legal sign-off, receipt and kill-switch */
function ReviewScene() {
  const { t } = useTourTime();
  const states = [
    "Draft",
    "Checking",
    "Needs revision",
    "In review",
    "Changes requested",
    "Legal review",
    "Approved",
    "Publish-ready",
  ];
  const current =
    t >= 6300
      ? "Needs revision"
      : t >= 4400
        ? "Publish-ready"
        : t >= 3700
          ? "Approved"
          : "Legal review";
  const killed = t >= 6300;
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <ol className="flex flex-wrap items-center gap-1">
        {states.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-sm px-1.5 text-[0.625rem] font-semibold whitespace-nowrap transition-colors duration-300",
                s === current ? "border-[3px]" : "border-2",
                s === current && s === "Publish-ready" && "bg-success text-canvas border-outline",
                s === current &&
                  s === "Needs revision" &&
                  "bg-blocker-bg text-blocker border-blocker",
                s === current &&
                  s !== "Publish-ready" &&
                  s !== "Needs revision" &&
                  "bg-accent-deep border-outline",
                s !== current && "border-line text-fg-muted",
              )}
            >
              {s}
            </span>
            {i < states.length - 1 ? (
              <ArrowRight aria-hidden className="text-fg-faint size-3 max-sm:hidden" />
            ) : null}
          </li>
        ))}
      </ol>
      <At
        ms={6300}
        className="border-blocker text-blocker flex items-center gap-2 rounded-sm border-2 border-dashed px-2 py-1 text-[0.6875rem] font-semibold"
      >
        <Undo2 aria-hidden className="size-3.5 shrink-0" /> Kill-switch: Brand admin edited E-19 →
        back to Needs revision, live over Realtime
      </At>
      <div className="grid min-h-0 gap-3 md:grid-cols-[0.8fr_1.3fr_1fr] md:items-start">
        <Panel title="submit · routing" className="hidden md:flex">
          <div className="space-y-2 text-xs">
            <p className="flex items-center gap-1.5 font-semibold">
              <span className="mono-id">v3</span>
              <ArrowRight aria-hidden className="size-3.5" />
              Legal review
            </p>
            <p>
              Rule: claims finding on <Id>CL-03</Id> → Legal
            </p>
            <p className="text-fg-muted">Manager queue skipped for this draft.</p>
          </div>
        </Panel>
        <Panel title="legal review · v2 → v3" gate>
          <div className="space-y-1 font-mono text-[0.6875rem] leading-snug">
            <p className="bg-blocker-bg text-blocker px-1.5 py-0.5 line-through decoration-1">
              − 14.2% assured annual returns … Oct 18 at Hall B
            </p>
            <p className="bg-success-bg text-success px-1.5 py-0.5">
              + 3-yr historical CAGR 14.2%, Q3 2026 + disclaimer … online, Oct 28, 7:00 PM IST
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <span className="text-fg-muted text-[0.625rem]">cites</span>
            <Id>CL-03</Id>
            <Id>F-112</Id>
          </div>
          <At ms={900} className="bg-code mt-2 rounded-sm px-2 py-1 text-[0.6875rem]">
            <b>@Legal</b> disclaimer wording is the standard one?
          </At>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="border-outline bg-elevated flex h-7 min-w-36 items-center rounded-sm border-2 px-2 text-[0.6875rem]">
              Reason:&nbsp;
              <Typed text="Disclaimer added" ms={1700} />
            </span>
            <FakeButton gate variant="ink" pressAt={3300} done={<Done>Signed off</Done>}>
              Sign off
            </FakeButton>
          </div>
        </Panel>
        <At ms={4400} className="min-w-0">
          <Panel
            title="publish receipt"
            right={
              killed ? (
                <span className="text-blocker text-[0.625rem] font-semibold">Revoked</span>
              ) : (
                <ShieldCheck aria-hidden className="text-success size-3.5" />
              )
            }
            className="h-full"
          >
            <div className={cn("space-y-1.5 text-[0.6875rem]", killed && "opacity-60")}>
              <p>
                <span className="text-fg-muted">SHA-256</span>{" "}
                <span className="font-mono">9c41…e7b2</span>
              </p>
              <p className="flex flex-wrap items-center gap-1">
                <span className="text-fg-muted">relies on</span>
                <Id>F-112</Id>
                <Id>E-19</Id>
              </p>
              <p>
                <span className="text-fg-muted">expires with</span>{" "}
                <span className="font-mono">F-112 · 31 Dec 2026</span>
              </p>
            </div>
            <p className="text-fg-muted mt-2 text-[0.625rem]">
              Fact edited or expired (60 s sweep) → back to revision.
            </p>
          </Panel>
        </At>
      </div>
    </div>
  );
}

/* 7 ─ Insights: GCS, KPIs, watchlist, shadow backtest (illustrative data) */
function InsightsScene() {
  const { t } = useTourTime();
  const bars = [
    { k: "Assured or guaranteed returns", n: 34 },
    { k: "Date or venue from another campaign", n: 27 },
    { k: "Product name casing", n: 19 },
    { k: "Outdated fee figure", n: 15 },
    { k: "Missing alt text", n: 12 },
    { k: "Logo clear-space", n: 8 },
  ];
  const rows = [
    { id: "TV-04", name: "Playful, not flippant", n: 41, gcs: 60, status: "Unclear" },
    { id: "VS-02", name: "Image warmth", n: 22, gcs: 73, status: "Watch" },
    { id: "CL-03", name: "No assured returns", n: 63, gcs: 97, status: "Clear" },
    { id: "G-07", name: "PayWise casing", n: 88, gcs: 99, status: "Clear" },
  ];
  const kpis = [
    { v: 86, s: "", d: 0, k: "average brand-fit score" },
    { v: 72, s: "%", d: 0, k: "approved on first review" },
    { v: 1.4, s: " d", d: 1, k: "median time to approval" },
    { v: 9, s: "", d: 0, k: "blockers caught this week" },
  ];
  return (
    <div className="flex h-full flex-col gap-2.5 p-3 md:p-4">
      <div className="bg-highlight text-highlight-fg border-outline flex flex-wrap items-center gap-2 rounded-sm border-2 px-2 py-1.5 font-mono text-[0.625rem] leading-snug md:text-[0.6875rem]">
        GCS(r) = 100 × (1 − [0.45 × DismissalRate + 0.35 × OverrideRate + 0.20 × LowConfidenceRate])
        <span className="bg-accent-deep text-fg border-outline ml-auto rounded-sm border-2 px-1.5 font-sans font-semibold">
          Illustrative data
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {kpis.map((k, i) => (
          <At
            key={k.k}
            ms={200 + i * 150}
            className="border-outline bg-elevated rounded-sm border-2 px-2 py-1.5"
          >
            <span className="font-mono text-xl leading-none font-semibold">
              <Count from={0} to={k.v} ms={200 + i * 150} decimals={k.d} suffix={k.s} />
            </span>
            <span className="text-fg-muted block text-[0.625rem]">{k.k}</span>
          </At>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-2.5 md:grid-cols-[1fr_1.15fr_1fr]">
        <Panel title="Top recurring issues · 30 days" className="hidden md:flex">
          <ul className="space-y-1">
            {bars.map((b) => (
              <li key={b.k} className="text-[0.625rem]">
                <span className="flex justify-between">
                  <span className="truncate">{b.k}</span>
                  <span className="font-mono">{b.n}</span>
                </span>
                <span className="bg-band-grey block h-1.5 rounded-full">
                  <span
                    className="bg-accent block h-1.5 rounded-full transition-[width] duration-700"
                    style={{ width: t >= 1000 ? `${(b.n / 34) * 100}%` : "0%" }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Guideline watchlist" className="hidden md:flex">
          <table className="w-full text-[0.625rem]">
            <thead className="text-fg-muted text-left">
              <tr>
                <th className="font-medium">Rule</th>
                <th className="font-medium">N</th>
                <th className="font-medium">GCS</th>
                <th className="font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-line border-t">
                  <td className="py-1">
                    <Id>{r.id}</Id>
                  </td>
                  <td className="font-mono">{r.n}</td>
                  <td className="font-mono">{r.gcs}</td>
                  <td>
                    <span
                      className={cn(
                        "rounded-sm border-2 px-1 font-semibold",
                        r.status === "Unclear" && "bg-blocker text-blocker-fg border-blocker",
                        r.status === "Watch" && "bg-warning-bg text-warning border-warning",
                        r.status === "Clear" && "text-success border-transparent",
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-fg-muted mt-1.5 text-[0.5625rem]">
            Below 65 queues 3 do and don&apos;t examples · 65–75 watch
          </p>
        </Panel>
        <At ms={2400} className="min-w-0">
          <Panel title="Shadow backtest · TV-04 v2 · 30 findings" gate className="h-full">
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[0.6875rem]">
              <dt className="text-fg-muted">Dismissals</dt>
              <dd className="font-mono font-semibold">
                42% → <Count from={42} to={8} ms={3000} suffix="%" />
              </dd>
              <dt className="text-fg-muted">Overrides</dt>
              <dd className="font-mono">37% held</dd>
              <dt className="text-fg-muted">Low confidence</dt>
              <dd className="font-mono">40% held</dd>
              <dt className="text-fg-muted">Projected GCS</dt>
              <dd className="font-mono text-base leading-none font-semibold">
                60 → <Count from={60} to={75} ms={3300} />
              </dd>
            </dl>
            <div className="mt-2.5">
              <FakeButton gate variant="ink" pressAt={5200} done={<Done>3 examples approved</Done>}>
                Approve 3 examples
              </FakeButton>
            </div>
          </Panel>
        </At>
      </div>
    </div>
  );
}

/* 8 ─ Measured results and the closing lockup */
function ProofScene() {
  const stats = [
    {
      big: <Count from={0} to={100} ms={200} suffix="%" />,
      k: "of shown findings cite a rule or fact",
      sub: "0 uncited",
    },
    {
      big: <Count from={0} to={1} ms={450} decimals={2} />,
      k: "blocker recall, 32 labelled blockers",
      sub: "0.96 precision · 60 golden drafts",
    },
    {
      big: <Count from={0} to={8.46} ms={700} decimals={2} suffix=" s" />,
      k: "non-AI P95 under load",
      sub: "0 lost · 20/20 pending runs completed",
    },
    {
      big: (
        <>
          ~<Count from={0} to={4.8} ms={950} decimals={1} suffix=" ms" />
        </>
      ),
      k: "warm local embedding",
      sub: "in the intent check",
    },
    {
      big: <span className="text-[clamp(16px,1.6vw,20px)] whitespace-nowrap">330 · 196 · 182</span>,
      k: "worker · web · database tests",
      sub: "passing, 3 Nov 2026",
    },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-4 md:p-6">
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {stats.map((s, i) => (
          <At
            as="li"
            key={s.k}
            ms={200 + i * 250}
            className={cn(
              "border-outline bg-elevated flex flex-col gap-1 rounded-lg border-2 p-3",
              i === 4 && "col-span-2 md:col-span-1",
            )}
          >
            <span className="font-mono text-[clamp(20px,2.2vw,28px)] leading-none font-semibold">
              {s.big}
            </span>
            <span className="text-xs leading-snug">{s.k}</span>
            <span className="text-fg-muted text-[0.625rem]">{s.sub}</span>
          </At>
        ))}
      </ul>
      <At
        ms={2400}
        className="bg-accent text-accent-fg flex flex-col items-start gap-3 rounded-lg p-5 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-3">
          <ErrataMark size={44} />
          <div>
            <p className="text-2xl leading-none font-semibold tracking-[-0.02em]">Errata</p>
            <p className="mt-1 text-sm opacity-90">
              {TAGLINE} Humans approve; Errata never publishes.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[0.6875rem] opacity-90 md:items-end">
          <span>brandlens-app.vercel.app</span>
          <span>github.com/maanit-gupta/Errata</span>
          <span className="font-sans">
            Team 9thHACK · Jagpreet Singh &amp; Maanit Gupta · SRMIST
          </span>
        </div>
      </At>
    </div>
  );
}

export const SCENE_VIEWS = [
  ProblemScene,
  SetupScene,
  DraftScene,
  PipelineScene,
  FindingsScene,
  ReviewScene,
  InsightsScene,
  ProofScene,
];
