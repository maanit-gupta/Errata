"use client";

import { MousePointer2 } from "lucide-react";
import { motion } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";
import { DEMO_ROLES, type TourRole } from "@/lib/marketing/tour";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the product tour scenes. Everything here is inside an aria-hidden canvas:
 * no focusable elements, no real buttons. The scene's text equivalent lives in lib/marketing/tour.
 */

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Scene-local time in ms (Infinity = show the finished scene) and whether motion is reduced. */
export const TourTime = createContext<{ t: number; reduced: boolean }>({
  t: Infinity,
  reduced: false,
});

export function useTourTime() {
  return useContext(TourTime);
}

/** Reveals its children once the scene clock passes `ms`: fade and 8px rise (DESIGN.md §8). */
export function At({
  ms,
  children,
  className,
  as = "div",
}: {
  ms: number;
  children: ReactNode;
  className?: string;
  as?: "div" | "span" | "li";
}) {
  const { t, reduced } = useTourTime();
  const shown = t >= ms;
  const Tag = as === "span" ? motion.span : as === "li" ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 8 }}
      transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/** Types `text` out from `ms` at `cps` characters a second. Reserves its final width. */
export function Typed({ text, ms, cps = 28 }: { text: string; ms: number; cps?: number }) {
  const { t } = useTourTime();
  const n = t === Infinity ? text.length : Math.max(0, Math.floor(((t - ms) / 1000) * cps));
  const shown = text.slice(0, n);
  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0">{shown}</span>
    </span>
  );
}

/** Number tween from `from` to `to` over `dur` ms starting at `ms`. */
export function Count({
  from,
  to,
  ms,
  dur = 900,
  decimals = 0,
  suffix = "",
}: {
  from: number;
  to: number;
  ms: number;
  dur?: number;
  decimals?: number;
  suffix?: string;
}) {
  const { t, reduced } = useTourTime();
  const p =
    reduced || t === Infinity ? (t >= ms ? 1 : 0) : Math.max(0, Math.min(1, (t - ms) / dur));
  const eased = 1 - (1 - p) ** 3;
  return (
    <>
      {(from + (to - from) * eased).toFixed(decimals)}
      {suffix}
    </>
  );
}

/** Mono ID chip: CL-03, F-112, WCAG 1.4.3. */
export function Id({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mono-id border-outline bg-elevated text-fg inline-flex h-5 items-center rounded-sm border-2 px-1 text-[0.6875rem] leading-none whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Severity chip (same look as SeverityBadge, without the icon dependency on DB types). */
export function Sev({ level }: { level: "blocker" | "warning" }) {
  return (
    <span
      className={cn(
        "label inline-flex h-5 items-center rounded-sm border-2 px-1.5 text-[0.6875rem] leading-none font-semibold",
        level === "blocker"
          ? "border-blocker bg-blocker text-blocker-fg"
          : "border-warning bg-warning-bg text-warning",
      )}
    >
      {level === "blocker" ? "Blocker" : "Warning"}
    </span>
  );
}

/**
 * A pretend button. `pressAt` animates a cursor onto it and presses it; `done` swaps the label
 * after the press. `gate` gives the thick outline used on every human decision.
 */
export function FakeButton({
  children,
  done,
  pressAt,
  variant = "outline",
  gate = false,
  className,
}: {
  children: ReactNode;
  done?: ReactNode;
  pressAt?: number;
  variant?: "ink" | "outline" | "yellow";
  gate?: boolean;
  className?: string;
}) {
  const { t, reduced } = useTourTime();
  const pressed = pressAt !== undefined && t >= pressAt;
  const cursorIn =
    pressAt !== undefined && t !== Infinity && t >= pressAt - 900 && t < pressAt + 700;
  return (
    <span
      className={cn(
        "relative inline-flex h-7 items-center justify-center gap-1 rounded-sm px-2.5 text-xs font-semibold whitespace-nowrap",
        gate ? "border-[3px]" : "border-2",
        "border-outline",
        variant === "ink" && "bg-accent text-accent-fg",
        variant === "outline" && "bg-elevated text-fg",
        variant === "yellow" && "bg-highlight text-highlight-fg",
        pressed && done && "border-success bg-success-bg text-success",
        className,
      )}
    >
      {pressed && done ? done : children}
      {cursorIn ? (
        <motion.span
          aria-hidden
          className="text-fg pointer-events-none absolute top-1/2 left-1/2 z-10"
          initial={reduced ? false : { x: 40, y: 34, opacity: 0 }}
          animate={{ x: 4, y: 2, opacity: 1, scale: t >= pressAt! ? 0.85 : 1 }}
          transition={{ duration: reduced ? 0 : 0.6, ease: EASE }}
        >
          <MousePointer2 className="fill-elevated size-5" strokeWidth={2} />
        </motion.span>
      ) : null}
    </span>
  );
}

/** Window card with a title bar (DESIGN.md §7.6), sized for the tour canvas. */
export function Panel({
  title,
  tone = "white",
  gate = false,
  children,
  className,
  right,
}: {
  title: ReactNode;
  tone?: "white" | "yellow" | "pink" | "ink";
  gate?: boolean;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-elevated border-outline flex min-w-0 flex-col overflow-hidden rounded-lg",
        gate ? "border-[3px]" : "border-2",
        className,
      )}
    >
      <div
        className={cn(
          "border-outline flex h-8 shrink-0 items-center justify-between gap-2 border-b-2 px-3 text-[0.6875rem] font-semibold",
          tone === "yellow" && "bg-highlight text-highlight-fg",
          tone === "pink" && "bg-band-pink text-fg",
          tone === "ink" && "bg-accent text-accent-fg",
          tone === "white" && "bg-code text-fg",
        )}
      >
        <span className="truncate">{title}</span>
        {right}
      </div>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </div>
  );
}

/** The pink demo strip from the app shell, with the active role filled in ink. */
export function DemoStrip({ role }: { role: TourRole }) {
  const { reduced } = useTourTime();
  return (
    <div className="bg-band-pink border-outline flex h-9 items-center gap-2 overflow-hidden border-b-2 px-3">
      <span className="label text-fg shrink-0 font-semibold">Demo</span>
      <span className="text-fg-muted hidden shrink-0 text-[0.6875rem] sm:inline">viewing as</span>
      <ul className="flex min-w-0 gap-1.5">
        {DEMO_ROLES.map((r) => (
          <li key={r} className="relative">
            {r === role ? (
              <motion.span
                layoutId="tour-role"
                className="bg-accent absolute inset-0 rounded-sm"
                transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
              />
            ) : null}
            <span
              className={cn(
                "border-outline relative inline-flex h-6 items-center rounded-sm border-2 px-1.5 text-[0.6875rem] font-semibold whitespace-nowrap",
                r === role ? "text-accent-fg" : "text-fg",
                r !== role && "max-sm:hidden",
              )}
            >
              {r}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
