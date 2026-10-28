"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, type ThemeChoice } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

function effective(): "dark" | "light" {
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** 40px square theme toggle (DESIGN.md §6.0, §8): flips between dark and light. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  useEffect(() => {
    const sync = () => setTheme(effective());
    sync();
    window.addEventListener("bl-theme", sync);
    return () => window.removeEventListener("bl-theme", sync);
  }, []);
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={theme ? `Switch to ${next} theme` : "Toggle theme"}
      className={cn(
        "border-outline text-fg hover:bg-hover inline-flex size-10 items-center justify-center rounded-sm border-2 transition-colors",
        className,
      )}
    >
      {theme === "light" ? (
        <Moon aria-hidden className="size-4" />
      ) : (
        <Sun aria-hidden className="size-4" />
      )}
    </button>
  );
}

const CHOICES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
];

/** Settings → Appearance: radio cards with a violet border and dot when selected. */
export function ThemeRadioCards({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState(initial);
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="sr-only">Theme</legend>
      {CHOICES.map(({ value, label, Icon }) => (
        <label
          key={value}
          className={cn(
            "bg-elevated flex h-12 cursor-pointer items-center gap-2 rounded-sm border-2 px-3 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)",
            choice === value
              ? "border-outline bg-highlight text-highlight-fg"
              : "border-line hover:bg-hover",
          )}
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={choice === value}
            onChange={() => {
              setChoice(value);
              applyTheme(value);
            }}
            className="sr-only"
          />
          <Icon aria-hidden className="size-4" />
          <span className="flex-1">{label}</span>
          <span
            aria-hidden
            className={cn(
              "size-2.5 rounded-full border",
              choice === value ? "bg-highlight-fg border-highlight-fg" : "border-control",
            )}
          />
        </label>
      ))}
    </fieldset>
  );
}
