"use client";

import { ImageIcon, Shuffle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Intent } from "@/lib/drafts/intent";

/** R3 Heroes 3 and 4: one-click demo inputs, so judges need no local files. Fictional PayWise data. */
const POSTER_URL = "/demo/sample-poster-low-contrast.png";

const POSTER_INTENT: Partial<Intent> = {
  goal: "Get first-time investors to start a Diwali SIP",
  audience: "Salaried 25–35s new to mutual funds",
  cta: "Register now",
  caption: "Start your Diwali SIP from Rs 500 a month. Join our free webinar online.",
};

const CROSS_MODAL_BODY =
  "Light up your savings this Diwali! Join the PayWise Diwali Wealth Webinar on Oct 18 at 7:00 PM IST, live in Hall B. Learn how a Rs 500 monthly SIP adds up. Seats are limited, so register today.";

const CROSS_MODAL_INTENT: Partial<Intent> = {
  goal: "Fill seats at the Diwali Wealth Webinar",
  audience: "Existing PayWise app users",
  cta: "Register today",
  landing_page_text:
    "Diwali Wealth Webinar. Online only, Oct 28, 7:00 PM IST. Register free in the PayWise app.",
};

export type Preset = "poster" | "cross_modal";

export function SamplePresets({
  onPoster,
  onText,
}: {
  onPoster: (file: File, intent: Partial<Intent>) => void;
  onText: (body: string, intent: Partial<Intent>) => void;
}) {
  const [loaded, setLoaded] = useState<Preset | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPoster = async () => {
    setBusy(true);
    try {
      const res = await fetch(POSTER_URL);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      onPoster(
        new File([blob], "sample-poster-low-contrast.png", { type: "image/png" }),
        POSTER_INTENT,
      );
      setLoaded("poster");
      toast.success("Sample poster loaded. Submit for check.");
    } catch {
      toast.error("Couldn't load the sample poster.");
    } finally {
      setBusy(false);
    }
  };

  const loadCrossModal = () => {
    onText(CROSS_MODAL_BODY, CROSS_MODAL_INTENT);
    setLoaded("cross_modal");
    toast.success("Cross-modal sample loaded. Submit for check.");
  };

  return (
    <section
      aria-label="Sample inputs"
      className="border-line bg-canvas flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2"
    >
      <span className="mono-label text-fg-faint">Try a sample</span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        aria-pressed={loaded === "poster"}
        onClick={() => void loadPoster()}
      >
        <ImageIcon aria-hidden /> Load Sample Poster (WCAG Contrast + Logo Check)
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-pressed={loaded === "cross_modal"}
        onClick={loadCrossModal}
      >
        <Shuffle aria-hidden /> Load Cross-Modal Conflict Sample (Copy ↔ Landing page ↔ Fact)
      </Button>
      {loaded === "poster" ? (
        <p className="text-fg-muted w-full text-xs" aria-live="polite">
          Loaded <span className="mono-id">sample-poster-low-contrast.png</span>: low-contrast fine
          print (WCAG 1.4.3), logo placement and no alt text (WCAG 1.1.1).
        </p>
      ) : loaded === "cross_modal" ? (
        <p
          className="flex w-full flex-wrap items-center gap-1.5 text-xs"
          aria-live="polite"
          aria-label="Copy says Oct 18 in Hall B; landing page says Oct 28 online; fact E-19 is the source of truth"
        >
          <span className="border-outline rounded-sm border px-1.5 py-0.5 font-mono">
            Copy: Oct 18 · Hall B
          </span>
          <span aria-hidden>≠</span>
          <span className="border-outline rounded-sm border px-1.5 py-0.5 font-mono">
            Landing page: Oct 28 · Online
          </span>
          <span aria-hidden>↔</span>
          <span className="border-outline bg-band-grey rounded-sm border px-1.5 py-0.5 font-mono">
            Fact E-19
          </span>
        </p>
      ) : null}
    </section>
  );
}
