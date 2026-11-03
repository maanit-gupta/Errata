"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import {
  TOUR_SCENES,
  TOUR_TOTAL_MS,
  formatClock,
  sceneAt,
  sceneStart,
  segmentFill,
} from "@/lib/marketing/tour";
import { cn } from "@/lib/utils";
import { DemoStrip, TourTime } from "./tour-kit";
import { SCENE_VIEWS } from "./tour-scenes";

type Mode = "auto" | "step";
const TICK_MS = 100;
const EASE = [0.2, 0.8, 0.2, 1] as const;

const btn =
  "border-outline inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-sm border-2 px-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Landing-page product tour (WAI-ARIA carousel pattern). Eight scenes play like a silent motion
 * video, or can be stepped through one at a time.
 *
 * Accessibility:
 * - The animated canvas is decorative (aria-hidden, nothing focusable). Each scene's full text is
 *   the visible caption below it, and all eight are in "Read the tour as text".
 * - Auto-play only runs while the player is on screen and the tab is visible, never starts under
 *   prefers-reduced-motion (step-through is the default there), stops when keyboard focus enters
 *   the player (APG carousel) and stops at the end instead of looping (DESIGN.md §8).
 * - The caption is a polite live region only when not auto-playing, so a screen reader isn't
 *   interrupted every few seconds.
 */
export function TourPlayer() {
  const reduced = useReducedMotion();
  const [userMode, setUserMode] = useState<Mode | null>(null);
  const mode: Mode = userMode ?? (reduced ? "step" : "auto");
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const seek = useCallback((ms: number) => {
    const v = Math.max(0, Math.min(TOUR_TOTAL_MS, ms));
    elapsedRef.current = v;
    setElapsed(v);
  }, []);

  // Only play while at least 40% of the player is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const running = mode === "auto" && playing && inView && pageVisible;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const next = Math.min(TOUR_TOTAL_MS, elapsedRef.current + (now - last));
      last = now;
      elapsedRef.current = next;
      setElapsed(next);
      if (next >= TOUR_TOTAL_MS) setPlaying(false);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const { index, local } = sceneAt(elapsed);
  const scene = TOUR_SCENES[index];
  const View = SCENE_VIEWS[index];
  const ended = elapsed >= TOUR_TOTAL_MS;
  const sceneT = mode === "step" ? Infinity : local;

  const goTo = (i: number) => seek(sceneStart(i));
  const togglePlay = () => {
    if (ended) {
      seek(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  };
  const restart = () => {
    seek(0);
    if (mode === "auto") setPlaying(true);
  };
  const chooseMode = (m: Mode) => {
    setUserMode(m);
    if (m === "auto") {
      // Continue from the start of the scene on screen (or from the top if it had finished).
      seek(ended ? 0 : sceneStart(index));
      setPlaying(true);
    }
  };
  // APG carousel: keyboard focus moving into the player stops auto-play until Play is pressed.
  const onFocusIn = (e: FocusEvent<HTMLDivElement>) => {
    const from = e.relatedTarget as Node | null;
    if (from && e.currentTarget.contains(from)) return;
    if (mode === "auto" && (e.target as HTMLElement).matches(":focus-visible")) setPlaying(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("summary")) return;
    if (e.key === "ArrowRight" && index < TOUR_SCENES.length - 1) {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      goTo(index - 1);
    }
  };

  const playLabel = ended ? "Replay" : playing ? "Pause" : "Play";
  const PlayIcon = ended ? RotateCcw : playing ? Pause : Play;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Errata product tour"
      onFocus={onFocusIn}
      onKeyDown={onKeyDown}
      className="bg-elevated border-outline overflow-hidden rounded-lg border-2"
    >
      {/* Top bar: title, live stage badge and the viewing mode */}
      <div className="border-outline bg-code flex flex-wrap items-center gap-3 border-b-2 px-3 py-2 sm:px-4">
        <span className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="bg-fg size-2 rounded-full" />
          ))}
        </span>
        <span className="text-sm font-semibold">Product tour</span>
        <span className="border-outline bg-highlight text-highlight-fg inline-flex h-6 items-center gap-1.5 rounded-sm border-2 px-2 text-xs font-semibold">
          <span className="sr-only">Current stage: </span>
          {scene.stage}
        </span>
        <div
          role="group"
          aria-label="Viewing mode"
          className="border-outline ml-auto inline-flex overflow-hidden rounded-sm border-2"
        >
          {(
            [
              ["auto", "Auto-play"],
              ["step", "Step through"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => chooseMode(m)}
              className={cn(
                "focus-visible:outline-focus h-8 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-solid",
                mode === m ? "bg-accent text-accent-fg" : "bg-elevated text-fg hover:bg-hover",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The slide: decorative canvas plus its caption (the text equivalent) */}
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`Scene ${index + 1} of ${TOUR_SCENES.length}: ${scene.title}`}
      >
        <div
          aria-hidden
          className="bg-canvas relative min-h-[648px] overflow-hidden md:h-[540px] md:min-h-0 lg:h-[520px]"
          data-testid="tour-canvas"
        >
          {scene.role ? <DemoStrip role={scene.role} /> : null}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={scene.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
              className={cn(scene.role ? "md:h-[calc(100%-2.25rem)]" : "md:h-full")}
            >
              <TourTime.Provider value={{ t: sceneT, reduced }}>
                <View />
              </TourTime.Provider>
            </motion.div>
          </AnimatePresence>
        </div>
        {/*
          Every caption sits in the same grid cell so the box is always as tall as the longest
          one: the page below never shifts while the tour plays. Only the current one is visible
          and exposed to assistive tech.
        */}
        <div className="border-outline grid border-t-2 px-3 py-3 sm:px-4">
          {TOUR_SCENES.map((s, i) => {
            const current = i === index;
            return (
              <div
                key={s.id}
                className={cn("[grid-area:1/1]", !current && "invisible")}
                aria-hidden={current ? undefined : true}
                data-testid={current ? "tour-caption" : undefined}
              >
                <p className="flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] font-semibold">
                  <span className="mono-id text-fg-muted">
                    {i + 1}/{TOUR_SCENES.length}
                  </span>
                  {s.title}
                  {s.illustrative ? (
                    <span className="label bg-accent-deep text-fg border-outline rounded-sm border-2 px-1.5 font-semibold">
                      Illustrative data
                    </span>
                  ) : null}
                </p>
                <p className="text-fg-muted mt-1 max-w-[80ch] text-sm leading-relaxed">
                  {s.summary}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Announces scene changes the visitor makes; silent while auto-playing (APG carousel). */}
      <p className="sr-only" aria-live={running ? "off" : "polite"} aria-atomic="true">
        {`Scene ${index + 1} of ${TOUR_SCENES.length}: ${scene.title}`}
      </p>

      {/* Controls */}
      <div className="border-outline bg-code flex flex-wrap items-center gap-2 border-t-2 px-3 py-3 sm:px-4">
        {mode === "auto" ? (
          <button
            type="button"
            onClick={togglePlay}
            className={cn(btn, "bg-accent text-accent-fg")}
          >
            <PlayIcon aria-hidden className="size-4" />
            <span>{playLabel}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className={cn(btn, "bg-elevated")}
          aria-label="Previous scene"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === TOUR_SCENES.length - 1}
          className={cn(btn, "bg-elevated")}
          aria-label="Next scene"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
        <button type="button" onClick={restart} className={cn(btn, "bg-elevated")}>
          <RotateCcw aria-hidden className="size-4" />
          <span className="max-sm:sr-only">Restart</span>
        </button>
        {mode === "auto" ? (
          <span className="mono-id text-fg-muted ml-auto" aria-hidden>
            {formatClock(elapsed)} / {formatClock(TOUR_TOTAL_MS)}
          </span>
        ) : null}

        <ol aria-label="Scenes" className="order-last grid w-full grid-cols-8 gap-1">
          {TOUR_SCENES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Scene ${i + 1}: ${s.title}`}
                title={s.title}
                className="group focus-visible:outline-focus flex h-7 w-full flex-col justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid"
              >
                <span
                  className={cn(
                    "border-outline bg-elevated block h-2.5 w-full overflow-hidden rounded-full border-2",
                    i === index && "h-3.5",
                  )}
                >
                  <span
                    className="bg-accent block h-full"
                    style={{
                      width: `${(mode === "step" ? (i <= index ? 1 : 0) : segmentFill(i, elapsed)) * 100}%`,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    "mt-0.5 truncate text-left text-[0.625rem] leading-tight max-md:hidden",
                    i === index ? "text-fg font-semibold" : "text-fg-muted",
                  )}
                >
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <details className="border-outline border-t-2 px-3 py-3 sm:px-4">
        <summary className="cursor-pointer text-[0.9375rem] font-semibold underline underline-offset-4">
          Read the tour as text
        </summary>
        <ol className="mt-3 space-y-3 text-[0.9375rem]">
          {TOUR_SCENES.map((s, i) => (
            <li key={s.id}>
              <p className="font-semibold">
                <span className="mono-id text-fg-muted mr-2">{i + 1}.</span>
                {s.title}
              </p>
              <p className="text-fg-muted mt-0.5">{s.summary}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
