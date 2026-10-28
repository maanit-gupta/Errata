import { FileCheck2, Lock, Quote, ShieldCheck, Stamp, UserCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconTile } from "@/components/brand/icon-tile";
import { SeverityBadge } from "@/components/brand/severity-badge";
import {
  HeroScene,
  StepApproveScene,
  StepCheckScene,
  StepRulesScene,
} from "@/components/illustrations";
import { Cta } from "@/components/marketing/cta";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/** Marketing section shell (DESIGN.md §5.2): band colour, 1200px container, 96px rhythm. */
export function Section({
  id,
  title,
  intro,
  band = "white",
  angled = false,
  children,
  className,
}: {
  id?: string;
  title?: ReactNode;
  intro?: ReactNode;
  band?: "white" | "grey" | "pink";
  angled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id && title ? `${id}-h` : undefined}
      className={cn(
        "scroll-mt-24",
        band === "grey" && "bg-band-grey",
        band === "pink" && "bg-band-pink",
        angled && "band-angled",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-[1200px] px-4 py-16 sm:px-6 md:py-24",
          angled && "pt-[calc(var(--angle)+4rem)] md:pt-[calc(var(--angle)+6rem)]",
        )}
      >
        {title ? (
          <Reveal className="mb-12 max-w-2xl space-y-4">
            <h2
              id={id ? `${id}-h` : undefined}
              className="text-[clamp(30px,3.6vw,48px)] leading-[1.1] font-semibold tracking-[-0.02em]"
            >
              {title}
            </h2>
            {intro ? <p className="text-fg-muted text-lg">{intro}</p> : null}
          </Reveal>
        ) : null}
        {children}
      </div>
    </section>
  );
}

const POINTS = [
  { Icon: Quote, label: "Cites every flag" },
  { Icon: FileCheck2, label: "Checks facts and dates" },
  { Icon: UserCheck, label: "People approve" },
];

/** Hero (DESIGN.md §9): headline, one line, two buttons, three icon points, the hero scene. */
export function Hero() {
  return (
    <section aria-labelledby="hero-h" className="overflow-hidden">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-14 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1fr_1.05fr] lg:pb-24">
        <div className="space-y-8">
          <h1
            id="hero-h"
            className="text-[clamp(40px,5.5vw,72px)] leading-[1.05] font-semibold tracking-[-0.03em]"
          >
            Every draft, checked before it ships.
          </h1>
          <p className="text-fg-muted max-w-[34rem] text-lg leading-relaxed">
            BrandLens checks posts, decks and images against your approved rules and facts. Every
            flag cites its source. People approve.
          </p>
          <div className="flex flex-wrap gap-3">
            <Cta href="/login">Try the demo</Cta>
            <Cta href="#how-it-works" variant="highlight">
              How it works
            </Cta>
          </div>
          <ul className="grid gap-4 pt-2 sm:grid-cols-3">
            {POINTS.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[0.9375rem] leading-snug">
                <IconTile Icon={Icon} />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <HeroScene className="mx-auto w-full max-w-[560px]" />
      </div>
    </section>
  );
}

const STEPS = [
  {
    Scene: StepRulesScene,
    title: "Add your rules",
    body: "Upload your brand guide. Approve the rule cards and facts it drafts.",
  },
  {
    Scene: StepCheckScene,
    title: "Check a draft",
    body: "Paste a caption or upload a file. Each flag names the rule it breaks.",
  },
  {
    Scene: StepApproveScene,
    title: "Review and approve",
    body: "Risky drafts go to the right reviewer. Every decision is logged.",
  },
];

/** How it works: three illustrated feature cards. */
export function Steps() {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {STEPS.map(({ Scene, title, body }, i) => (
        <li key={title}>
          <Reveal
            index={i}
            className="bg-elevated border-outline flex h-full flex-col overflow-hidden rounded-lg border-2"
          >
            <div className="bg-band-pink border-outline flex items-center justify-center border-b-2 px-6 py-6">
              <Scene className="w-full max-w-[260px]" />
            </div>
            <div className="space-y-2 p-6">
              <p className="mono-id text-fg-muted">Step {i + 1}</p>
              <h3 className="text-xl leading-tight font-bold tracking-[-0.01em]">{title}</h3>
              <p className="text-fg-muted text-[0.9375rem]">{body}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

/** The context-bleed example: last campaign's venue caught by a Fact Vault match. */
export function BleedExample() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <h2
          id="example-h"
          className="text-[clamp(30px,3.6vw,48px)] leading-[1.1] font-semibold tracking-[-0.02em]"
        >
          Caught without AI.
        </h2>
        <p className="text-fg-muted max-w-md text-lg">
          The draft reused last campaign&apos;s date and venue. The Fact Vault knows this
          campaign&apos;s details, so the flag is certain and cites{" "}
          <span className="mono-id text-fg">E-19</span>.
        </p>
      </div>
      <figure className="bg-elevated border-outline overflow-hidden rounded-lg border-2">
        <div className="bg-highlight border-outline flex h-10 items-center gap-2 border-b-2 px-4">
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden className="bg-highlight-fg size-2 rounded-full" />
          ))}
          <span className="text-highlight-fg ml-2 text-sm font-semibold">
            Instagram caption · v1
          </span>
        </div>
        <div className="space-y-5 p-6">
          <p className="text-base leading-relaxed">
            …webinar registrations{" "}
            <mark className="bg-blocker-bg text-fg decoration-blocker underline decoration-2 underline-offset-4">
              close Oct 18 at Hall B, Chandigarh
            </mark>
            .
          </p>
          <div className="bg-code space-y-1 rounded-sm p-4 font-mono text-[0.8125rem] leading-relaxed">
            <p className="text-fg-muted">Fact Vault match</p>
            <p>E-19 · Diwali SIP webinar · Oct 28, online</p>
            <p className="text-fg-muted">E-11 · Navratri Savings · Oct 18, Hall B (ended)</p>
          </div>
          <p className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
            <SeverityBadge severity="blocker" />
            <span className="mono-id border-outline rounded-sm border-2 px-1.5">E-19</span>
            Date and venue belong to another campaign.
          </p>
        </div>
      </figure>
    </div>
  );
}

const TRUST = [
  {
    Icon: ShieldCheck,
    title: "Minimal context to AI",
    body: "Only the redacted draft and a few rule snippets.",
  },
  { Icon: Lock, title: "Never-send items", body: "Mark a rule or fact and it stays local." },
  {
    Icon: FileCheck2,
    title: "Isolated by organisation",
    body: "Row-level security on every table.",
  },
  { Icon: Stamp, title: "People sign off", body: "Nothing is published automatically." },
];

/** Trust band: four short points and a link to the AI-use page. */
export function TrustPoints() {
  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map(({ Icon, title, body }, i) => (
          <li key={title}>
            <Reveal index={i} className="space-y-3">
              <IconTile Icon={Icon} />
              <h3 className="text-lg leading-tight font-bold">{title}</h3>
              <p className="text-fg-muted text-[0.9375rem]">{body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-10">
        <Link
          href="/ai-use"
          className="text-fg text-[0.9375rem] font-semibold underline underline-offset-4 hover:decoration-2"
        >
          See every service and what it receives
        </Link>
      </p>
    </>
  );
}

/** Featured card (DESIGN.md §7.4): the demo call to action. */
export function FeaturedDemo() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <h2
          id="demo-h"
          className="text-[clamp(30px,3.6vw,48px)] leading-[1.1] font-semibold tracking-[-0.02em]"
        >
          Try it as any role.
        </h2>
        <p className="text-fg-muted max-w-md text-lg">
          Sign in as a creator, a reviewer or Legal. No sign-up.
        </p>
      </div>
      <div className="bg-accent text-accent-fg relative rounded-lg p-8 pt-10">
        <span className="bg-highlight text-highlight-fg border-outline absolute -top-4 right-8 rounded-sm border-2 px-3 py-1 text-sm font-bold">
          Live demo
        </span>
        <h3 className="text-2xl font-bold tracking-[-0.01em]">PayWise workspace</h3>
        <p className="mt-2 opacity-90">A fictional fund app with real rules and drafts.</p>
        <ul className="mt-6 space-y-2 text-[0.9375rem]">
          <li>Six demo roles</li>
          <li>Drafts ready to check</li>
          <li>Nothing is ever published</li>
        </ul>
        <Cta href="/login" variant="inverse" className="mt-8 w-full sm:w-auto">
          Open the demo
        </Cta>
      </div>
    </div>
  );
}
