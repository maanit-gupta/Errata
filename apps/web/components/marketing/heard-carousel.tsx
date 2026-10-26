"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { cn } from "@/lib/utils";

// Paraphrased from plan p.6 and p.23. Attributed by role and city only (names need consent:
// PROGRESS → Open questions).
const SLIDES = [
  {
    tab: "AGENCY",
    failure:
      "Work gets made for the person making it, not the person viewing it, and the founder ends up rewriting it at the last stage of a three-step chain.",
    requirement: "Mandatory audience and intent at submission, and a risk-sorted queue with diffs.",
    who: "AGENCY FOUNDER · MOHALI",
  },
  {
    tab: "STUDENT ORG",
    failure:
      "Handling two events at once, an AI assistant pulled the venue and time from the wrong one. The copy read fluently, so the post went out with both details wrong.",
    requirement:
      "A deterministic Fact Vault match on dates, venues and campaign facts before review.",
    who: "STUDENT ORG MARKETING · CHANDIGARH",
  },
  {
    tab: "CULTURAL SOCIETY",
    failure:
      "Feedback arrives days late, says “make it more on-brand”, and contradicts the previous round because each reviewer reads the guidelines differently.",
    requirement:
      "Rule-cited fixes in seconds before submitting, with rewrites that keep the campaign hook.",
    who: "CULTURAL SOCIETY MARKETING · PUNE",
  },
  {
    tab: "SMB CREATOR",
    failure:
      "Clients demand strict consistency but hand over a static PDF style guide nobody re-reads, with no signal on which rules keep tripping people up.",
    requirement: "PDF guides turned into rule cards, plus a clarity score per rule.",
    who: "SMB CONTENT CREATOR",
  },
];

/**
 * "What we heard" (DESIGN.md §8.8): tabs, crossfade, auto-rotate every 6s, paused on hover or
 * focus and by the explicit pause button (WCAG 2.2.2). No rotation under reduced motion.
 */
export function HeardCarousel() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [hoverPause, setHoverPause] = useState(false);
  const [paused, setPaused] = useState(false);
  const rotating = !reduced && !paused && !hoverPause;

  useEffect(() => {
    if (!rotating) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [rotating]);

  return (
    <div
      onMouseEnter={() => setHoverPause(true)}
      onMouseLeave={() => setHoverPause(false)}
      onFocus={() => setHoverPause(true)}
      onBlur={() => setHoverPause(false)}
    >
      <Tabs.Root value={active} onValueChange={(v) => setActive(Number(v))}>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs.List
            aria-label="Discovery interviews"
            className="border-line flex flex-wrap border"
          >
            {SLIDES.map((s, i) => (
              <Tabs.Tab
                key={s.tab}
                value={i}
                className="mono-label text-fg-muted hover:bg-hover data-active:bg-accent data-active:text-accent-fg h-9 px-3 transition-colors duration-[80ms]"
              >
                {s.tab}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {reduced ? null : (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="border-line text-fg-muted hover:bg-hover inline-flex h-9 items-center gap-1.5 border px-3 text-sm"
            >
              {paused ? (
                <Play aria-hidden className="size-3.5" />
              ) : (
                <Pause aria-hidden className="size-3.5" />
              )}
              {paused ? "Play" : "Pause"} rotation
            </button>
          )}
        </div>
        <div className="relative mt-8 grid">
          {SLIDES.map((s, i) => (
            <Tabs.Panel
              key={s.tab}
              value={i}
              keepMounted
              className={cn(
                "col-start-1 row-start-1 space-y-6 transition-opacity duration-300",
                i === active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <p className="max-w-4xl text-[22px] leading-snug font-light">{s.failure}</p>
              <p className="text-fg-muted max-w-3xl text-sm">
                <span className="mono-label text-fg-faint mr-2">Requirement</span>
                {s.requirement}
              </p>
              <p className="mono-label bg-accent-deep text-accent-soft inline-block px-2 py-1">
                {s.who}
              </p>
            </Tabs.Panel>
          ))}
        </div>
      </Tabs.Root>
    </div>
  );
}
