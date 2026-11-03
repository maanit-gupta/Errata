"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cssPatch, type VisualFix } from "@/lib/drafts/visual-fix";

const CHANGE: Record<VisualFix["strategy"], string> = {
  text: "Change the text colour",
  background: "Change the background colour",
  both: "Change the text and background colours",
};

function Chip({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  // Colours come from the measured image and the org's palette (validated #RRGGBB), so they are
  // inline styles, not tokens. The "before" chip has no text: rendering text in failing colours
  // would itself be inaccessible.
  return (
    <span
      role="img"
      aria-label={label}
      className="border-outline inline-flex h-10 w-16 items-center justify-center rounded-sm border-2"
      style={{ backgroundColor: bg }}
    >
      <span aria-hidden className="block h-2 w-8 rounded-sm" style={{ backgroundColor: fg }} />
    </span>
  );
}

async function copyCss(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("CSS fix copied.");
    return true;
  } catch {
    toast.error("Couldn't copy. Select the CSS and copy it by hand.");
    return false;
  }
}

/**
 * Hero 3: before/after preview of a palette-only contrast fix. A suggestion only: nothing changes
 * in the image, and accepting (on the finding card) records the choice for the design file.
 */
export function VisualAutoHealPreview({ fix, sample }: { fix: VisualFix; sample: string }) {
  const large = fix.required_ratio === 3;
  const name = (hex: string, palette: string | null) => (palette ? `${palette} ${hex}` : hex);
  const css = cssPatch(fix);
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!(await copyCss(css))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <figure
      aria-label="Suggested on-brand contrast fix"
      className="border-line bg-canvas space-y-2 rounded-sm border p-3"
    >
      <figcaption className="mono-label text-fg-faint">
        Suggested palette fix · WCAG 1.4.3
      </figcaption>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Chip
          fg={fix.original_text_hex}
          bg={fix.original_bg_hex}
          label={`Now: text ${fix.original_text_hex} on ${fix.original_bg_hex}, ${fix.original_ratio} to 1`}
        />
        <span className="font-mono text-xs">
          {fix.original_text_hex} · {fix.original_ratio}:1{" "}
          <span className="border-danger text-danger rounded-sm border px-1">FAIL</span>
        </span>
        <span aria-hidden>→</span>
        <span
          className={`border-outline inline-flex items-center rounded-sm border-2 px-3 py-1 ${large ? "text-2xl font-bold" : "text-sm font-semibold"}`}
          style={{ color: fix.healed_text_hex, backgroundColor: fix.healed_bg_hex }}
        >
          {sample.slice(0, 24) || "Aa"}
        </span>
        <span className="font-mono text-xs">
          {fix.healed_text_hex} · {fix.healed_ratio}:1{" "}
          <span className="border-outline rounded-sm border px-1">WCAG AA PASS</span>
        </span>
      </div>
      <p className="text-fg-muted text-xs">
        {CHANGE[fix.strategy]}: text {name(fix.healed_text_hex, fix.healed_text_name)} on{" "}
        {name(fix.healed_bg_hex, fix.healed_bg_name)}. Needs {fix.required_ratio} : 1
        {large ? " (large text)" : ""}. Colours come only from your approved palette. Nothing
        changes in the image until you update the design file.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <pre
          tabIndex={0}
          aria-label="CSS for this fix"
          className="bg-code border-line min-w-0 flex-1 overflow-x-auto rounded-sm border p-2 font-mono text-xs"
        >
          {css}
        </pre>
        <Button variant="secondary" size="sm" type="button" onClick={() => void onCopy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span aria-live="polite">{copied ? "✓ Copied" : "Copy CSS fix"}</span>
        </Button>
      </div>
    </figure>
  );
}
