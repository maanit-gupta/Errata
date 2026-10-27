"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { useTypewriter } from "@/components/motion/use-typewriter";
import { cn } from "@/lib/utils";

export const HERO_WORDS = [
  "claims policy",
  "Fact Vault",
  "tone of voice",
  "glossary",
  "brand palette",
  "WCAG 2.2 AA",
  "campaign facts",
] as const;

/** Hero H1 (DESIGN.md §8.3). Screen readers get one stable sentence; the typing is decorative. */
export function HeroHeadline({ onWord }: { onWord?: (i: number) => void }) {
  const reduced = useReducedMotion();
  const { text, index, typing } = useTypewriter(HERO_WORDS, reduced);
  useEffect(() => onWord?.(index), [index, onWord]);
  return (
    <h1 className="text-[clamp(44px,6vw,88px)] leading-[1.02] font-light tracking-[-0.03em]">
      <span className="sr-only">Every draft, checked against your brand rules and facts.</span>
      <span aria-hidden>
        Every draft, checked against your{" "}
        <span className="whitespace-nowrap">
          <span className="text-gradient-word">{text}</span>
          <span
            className={cn(
              "text-fg/15 ml-1 inline-block align-baseline",
              !reduced && !typing && "cursor-blink",
            )}
          >
            ▮
          </span>
        </span>
      </span>
    </h1>
  );
}

const TILES = [
  ["01", "INGEST", "12ms"],
  ["02", "PROTECT", "4ms"],
  ["03", "FILTERS", "18ms"],
  ["04", "RETRIEVE", "31ms"],
  ["05", "LLM PASS", "2.9s"],
  ["06", "CITATION GATE", "9ms"],
] as const;

const CHIPS = [
  { code: "CL-03", label: "Assured returns", blocker: true },
  { code: "E-19", label: "Venue mismatch", blocker: true },
  { code: "G-07", label: "Product casing", blocker: false },
  { code: "WCAG 1.4.3", label: "2.9 : 1", blocker: false },
] as const;

/**
 * Pipeline loop (DESIGN.md §4.1): the terminal chip flashes, tiles flip `⟳ checking` → `✓ ms`
 * at a 120ms stagger, then the cited findings slide out under the gate. Static under reduced motion.
 */
export function PipelineLoop({ cycle }: { cycle: number }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timers = [setTimeout(() => setStep(0), 0)];
    for (let i = 1; i <= TILES.length + 2; i++) {
      timers.push(setTimeout(() => setStep(i), 600 + i * 120));
    }
    return () => timers.forEach(clearTimeout);
  }, [cycle, reduced]);

  const flashing = !reduced && step === 0;
  return (
    <div aria-hidden className="relative space-y-3 font-mono text-[0.78125rem]">
      <p
        className={cn(
          "border-line-strong inline-block border px-3 py-1.5 transition-colors duration-500",
          flashing ? "text-fg-muted" : "text-success border-success",
        )}
      >
        $ brandlens check --intent &quot;webinar sign-ups&quot;
      </p>
      <div className="bg-accent ml-6 h-6 w-px" />
      <div className="border-line-strong bg-code grid grid-cols-2 gap-px border sm:grid-cols-3">
        {TILES.map(([n, label, ms], i) => {
          const done = reduced || step > i;
          return (
            <div key={n} className="bg-elevated space-y-2 p-3">
              <p className="mono-label text-fg-faint">
                {n} {label}
              </p>
              <p className={done ? "text-success" : "text-fg-muted"}>
                {done ? `✓ ${ms}` : "⟳ checking"}
              </p>
              <svg viewBox="0 0 60 12" className="h-3 w-full">
                <polyline
                  points="0,10 10,7 20,8 30,3 40,6 50,2 60,4"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1"
                  strokeDasharray="80"
                  strokeDashoffset={done || reduced ? 0 : 80}
                  style={{ transition: reduced ? "none" : "stroke-dashoffset 800ms ease-out" }}
                />
              </svg>
              <p className="mono-label text-fg-faint text-[0.625rem]">
                {i % 2 ? "FINDINGS" : "LATENCY"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="bg-accent ml-6 h-4 w-px" />
      <div className="space-y-1.5">
        {CHIPS.map((c, i) => (
          <p
            key={c.code}
            className={cn(
              "flex items-center gap-2 transition-all duration-300",
              step > TILES.length + (i > 1 ? 1 : 0) || reduced
                ? "translate-x-0 opacity-100"
                : "-translate-x-2 opacity-0",
            )}
          >
            <span
              className={cn(
                "border px-1.5 py-0.5",
                c.blocker
                  ? "bg-blocker text-blocker-fg border-blocker"
                  : "border-line-strong text-accent-soft",
              )}
            >
              {c.code}
            </span>
            <span className="text-fg-muted">· {c.label}</span>
            <span className="text-success">✓ cited</span>
          </p>
        ))}
        <p className="mono-label text-fg-faint pt-1">DRAFT v2 · 4 FINDINGS</p>
      </div>
    </div>
  );
}

/** Hero stage (DESIGN.md §8.3): 7/5 split; the pipeline replays on every word change. */
export function HeroStage({ children }: { children: ReactNode }) {
  const [cycle, setCycle] = useState(0);
  return (
    <div className="grid items-center gap-12 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        <p className="mono-label text-accent-soft">Pre-publication brand governance</p>
        <HeroHeadline onWord={setCycle} />
        {children}
      </div>
      <div className="lg:col-span-5">
        <PipelineLoop cycle={cycle} />
      </div>
    </div>
  );
}
