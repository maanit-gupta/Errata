import type { ReactNode } from "react";
import { PixelGlyph, type GlyphName } from "@/components/brand/pixel-glyphs";
import { Cta } from "@/components/marketing/cta";
import { README } from "@/components/marketing/links";
import { Reveal } from "@/components/motion/reveal";
import type { EvalSummary } from "@/lib/eval-report";
import { cn } from "@/lib/utils";

/** Marketing section shell: 128/80/64px vertical rhythm, 1280px grid, hairline top. */
export function Section({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-h` : undefined}
      className={cn("border-line relative scroll-mt-20 border-t", className)}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:py-20 lg:py-32">
        {eyebrow ? <p className="mono-label text-accent-soft mb-4">{eyebrow}</p> : null}
        {title ? (
          <Reveal>
            <h2
              id={id ? `${id}-h` : undefined}
              className="mb-12 max-w-4xl text-[clamp(32px,4vw,52px)] leading-[1.08] font-light tracking-[-0.02em]"
            >
              {title}
            </h2>
          </Reveal>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** §8.4 left: the one multicolour sentence in the product. */
export function DimensionSentence() {
  const span = (c: string, t: string) => <span style={{ color: `var(--dim-${c})` }}>{t}</span>;
  return (
    <p id="checks" className="scroll-mt-24 text-[clamp(24px,2.6vw,34px)] leading-snug font-light">
      Checks {span("tone", "tone of voice")}, {span("terms", "product terms")},{" "}
      {span("facts", "dates, venues and fees")}, {span("claims", "return claims")},{" "}
      <span className="opacity-80">
        {span("visual", "logos and palette")}, and {span("access", "contrast and alt text")}
      </span>
      <span className="text-fg-muted">
        . Against your approved rules, not a model&apos;s taste.
      </span>
    </p>
  );
}

/** §8.4 right: plan p.5's real failure trace as a mini UI. */
export function BleedCard() {
  return (
    <figure className="border-line-strong bg-elevated border">
      <div className="border-line flex items-center gap-1.5 border-b px-3 py-2">
        <span aria-hidden className="bg-blocker size-2" />
        <span aria-hidden className="bg-line-strong size-2" />
        <span aria-hidden className="bg-line-strong size-2" />
        <span className="mono-label text-fg-faint ml-2">Instagram caption · Diwali SIP · v1</span>
      </div>
      <div className="space-y-4 p-4 text-sm">
        <p className="bg-code font-mono text-[0.8125rem] leading-relaxed">
          …registrations for the webinar{" "}
          <mark className="bg-blocker-bg text-fg decoration-blocker underline decoration-2 underline-offset-4">
            close Oct 18 at Hall B, Chandigarh
          </mark>
          .
        </p>
        <div className="border-line space-y-1 border-l-2 pl-3 font-mono text-[0.78125rem]">
          <p className="text-fg-faint">[03 filters] fact vault match</p>
          <p className="text-fg-muted">E-19 · Diwali SIP webinar · Oct 28, online</p>
          <p className="text-fg-muted">E-11 · Navratri Savings 2026 · Oct 18, Hall B (ended)</p>
        </div>
        <p className="flex flex-wrap items-center gap-2">
          <span className="mono-label bg-blocker text-blocker-fg px-1.5 py-0.5">BLOCKER</span>
          <span className="mono-id text-accent-soft border-line-strong border px-1.5">E-19</span>
          <span className="text-fg-muted">value belongs to Navratri Savings 2026</span>
        </p>
      </div>
      <figcaption className="border-line text-fg-muted border-t px-4 py-2.5 text-xs">
        Caught at Stage 3, with no AI judgement needed.
      </figcaption>
    </figure>
  );
}

function Snippet({ children }: { children: ReactNode }) {
  return (
    <pre className="bg-code border-line text-fg-muted overflow-x-auto border p-4 font-mono text-[0.78125rem] leading-[1.6] whitespace-pre-wrap">
      {children}
    </pre>
  );
}

const FEATURES: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  anchor: string;
  snippet: ReactNode;
}[] = [
  {
    eyebrow: "CITATION GATE",
    title: "No uncited finding is ever shown",
    body: "A finding survives only if the rule or fact it cites was retrieved for this run, matches its dimension, and its quote is found in your draft.",
    anchor: "citation-gate",
    snippet: (
      <>
        <span className="text-success">✓ kept CL-03</span> (retrieved, dim=claims, quote found)
        {"\n"}
        <span className="text-success">✓ kept E-19</span> (deterministic, fact vault){"\n"}
        <span className="text-danger">✕ dropped X-99</span> (not retrieved){"\n"}
        <span className="text-danger">✕ dropped TV-04</span> (quote not in draft)
      </>
    ),
  },
  {
    eyebrow: "INTENT-VERIFIED REWRITES",
    title: "Fixes that keep your hook",
    body: "Every rewrite is re-checked against the intent you gave: same goal, same audience, same call to action. If it drifts, you get no fix rather than a bad one.",
    anchor: "intent-verification",
    snippet: (
      <>
        <span className="text-blocker line-through">“14.2% assured annual returns”</span>
        {"\n"}
        <span className="text-success">“14.2% 3-yr historical CAGR*”</span>
        {"\n\n"}cosine 0.91 ≥ 0.82 · CTA “Register now” kept{"\n"}
        re-check <span className="text-success">✓</span> · 9ms
      </>
    ),
  },
  {
    eyebrow: "RISK-ROUTED REVIEW",
    title: "Reviewers see the riskiest work first",
    body: "Open claims go to Legal, contrast to Accessibility, and clean drafts skip straight to the approver queue. The reason is written on every row.",
    anchor: "routing",
    snippet: (
      <>
        RISK <span className="text-blocker">■■■■□</span> 22 Flexi-Cap deck{" "}
        <span className="text-accent-soft">→ LEGAL</span>
        {"\n"}RISK <span className="text-warning">■■■□□</span> 14 Diwali SIP caption{" "}
        <span className="text-accent-soft">→ MANAGER</span>
        {"\n"}RISK <span className="text-warning">■□□□□</span> 6 Webinar invite{" "}
        <span className="text-accent-soft">→ MANAGER</span>
        {"\n\n"}rule: open CL-03 claim → Legal · approver queue skipped
      </>
    ),
  },
  {
    id: "insights",
    eyebrow: "GUIDELINE CLARITY SCORE",
    title: "Find the rules that confuse people",
    body: "Dismissals, overrides and low-confidence hits add up to a score per rule. Unclear rules get generated do/don't examples for a brand admin to approve.",
    anchor: "guideline-clarity-score",
    snippet: (
      <>
        RULE N GCS STATUS{"\n"}
        <span className="text-blocker">TV-04 60 41 UNCLEAR</span>
        {"\n"}VS-02 73 58 <span className="text-blocker">UNCLEAR</span>
        {"\n"}CL-03 97 82 <span className="text-success">clear</span>
        {"\n"}G-07 99 91 <span className="text-success">clear</span>
      </>
    ),
  },
];

/** §8.5 feature cells, 2 up. */
export function FeatureCells() {
  return (
    <div className="border-line bg-line grid gap-px border md:grid-cols-2">
      {FEATURES.map((f, i) => (
        <Reveal key={f.eyebrow} index={i} className="bg-canvas flex flex-col gap-4 p-6 lg:p-8">
          <p id={f.id} className="mono-label text-fg-faint scroll-mt-24">
            {f.eyebrow}
          </p>
          <h3 className="text-2xl font-light">{f.title}</h3>
          <p className="text-fg-muted max-w-[60ch] text-[0.9375rem]">{f.body}</p>
          <Snippet>{f.snippet}</Snippet>
          <a
            href={README(f.anchor)}
            className="text-accent-soft mt-auto text-sm underline-offset-4 hover:underline"
          >
            Docs →<span className="sr-only"> {f.title}</span>
          </a>
        </Reveal>
      ))}
    </div>
  );
}

/** §8.6 guarantees band. Latency rows read the P14 report when it exists, else show TARGET. */
export function GuaranteesBand({ report }: { report: EvalSummary | null }) {
  const date = report?.generatedAt.slice(0, 10);
  const p95 = report?.p95TotalMs != null ? `${(report.p95TotalMs / 1000).toFixed(1)} s` : null;
  const intent = report?.intentP95Ms != null ? `${report.intentP95Ms} ms` : null;
  const cells: { value: string; label: string; chip?: string }[] = [
    { value: "100%", label: "of shown flags cite a rule, fact or WCAG criterion" },
    { value: "0", label: "unapproved auto-publishes. BrandLens has no publish button" },
    {
      value: p95 ?? "<15 s",
      label: "P95 text analysis, ≤ 2,000 words",
      chip: p95 ? `MEASURED · ${date}` : "TARGET",
    },
    {
      value: intent ?? "<15 ms",
      label: "intent verification per rewrite",
      chip: intent ? `MEASURED · ${date}` : "TARGET",
    },
  ];
  return (
    <ul className="border-line bg-line grid gap-px border sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((c) => (
        <li key={c.label} className="bg-canvas space-y-3 p-6">
          <p className="font-mono text-[clamp(36px,4vw,56px)] leading-none font-light">{c.value}</p>
          <p className="text-fg-muted text-sm">{c.label}</p>
          {c.chip ? (
            <p
              className={cn(
                "mono-label inline-block border px-1.5 py-0.5",
                c.chip === "TARGET"
                  ? "border-line-strong text-fg-faint"
                  : "border-success text-success",
              )}
            >
              {c.chip}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const EVIDENCE = [
  {
    value: "98%",
    label: "of ads ASCI scrutinised in FY 2024–25 needed modification",
    source: "ASCI Annual Complaints Report 2024–25",
    href: "https://www.ascionline.in/wp-content/uploads/2025/05/ASCI-Press-Release-Annual-Complaints-Report-2024-25-1.pdf",
  },
  {
    value: "79.1%",
    label: "of the top million home pages have low-contrast text",
    source: "WebAIM Million 2025",
    href: "https://webaim.org/projects/million/2025",
  },
  {
    value: "49%",
    label: "of marketers cite tone-of-voice issues with AI-generated content",
    source: "Kaltura 2023 survey, n=500",
    href: "https://www.mediapost.com/publications/article/390709/",
  },
  {
    value: "72–96 h",
    label: "typical turnaround per post across approval chains",
    source: "Our 4 discovery interviews, Oct 2026",
    href: README("discovery"),
  },
];

/** §8.7 evidence band, every stat footnoted. */
export function EvidenceBand() {
  return (
    <ol className="border-line bg-line grid gap-px border sm:grid-cols-2 lg:grid-cols-4">
      {EVIDENCE.map((e, i) => (
        <li key={e.value} className="bg-canvas flex flex-col gap-3 p-6">
          <p className="text-[clamp(36px,4vw,56px)] leading-none font-light">{e.value}</p>
          <p className="text-fg-muted text-sm">{e.label}</p>
          <p className="mono-id text-fg-faint mt-auto text-xs">
            [{i + 1}]{" "}
            <a
              href={e.href}
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg underline underline-offset-4"
            >
              {e.source}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </li>
      ))}
    </ol>
  );
}

const TRUST: { glyph: GlyphName; title: string; body: string }[] = [
  {
    glyph: "shield-check",
    title: "Minimal context to the AI",
    body: "Only the redacted draft chunk and the top-k retrieved snippets are sent.",
  },
  {
    glyph: "chart-bars",
    title: "Local embeddings",
    body: "Vault text is embedded inside our own worker with bge-small; it never leaves for an embedding API.",
  },
  {
    glyph: "lock",
    title: "Never-send vault items",
    body: "Mark a rule or fact “never send” and it is checked locally only.",
  },
  {
    glyph: "id-badge",
    title: "Row-level isolation per organisation",
    body: "Postgres row-level security on every organisation table, including realtime.",
  },
  {
    glyph: "stamp",
    title: "Human sign-off",
    body: "Approvals are recorded with a reason. Nothing is published automatically.",
  },
  {
    glyph: "eye",
    title: "AI-use disclosure",
    body: "Every external provider is named, with what it receives and how it treats it.",
  },
];

/** §8.9 responsible-design grid. */
export function TrustGrid() {
  return (
    <>
      <ul className="border-line bg-line grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
        {TRUST.map((t, i) => (
          <li key={t.title} className="bg-canvas p-6">
            <Reveal index={i} className="space-y-3">
              <PixelGlyph name={t.glyph} size={32} />
              <h3 className="text-xl font-light">{t.title}</h3>
              <p className="text-fg-muted text-sm">{t.body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Cta href="/login">Try the demo</Cta>
        <Cta href="/ai-use" variant="secondary">
          Services &amp; AI use
        </Cta>
      </div>
    </>
  );
}
