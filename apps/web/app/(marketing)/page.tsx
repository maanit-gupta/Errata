import {
  BleedCard,
  DimensionSentence,
  EvidenceBand,
  FeatureCells,
  GuaranteesBand,
  Section,
  TrustGrid,
} from "@/components/marketing/sections";
import { Cta } from "@/components/marketing/cta";
import { HeardCarousel } from "@/components/marketing/heard-carousel";
import { HeroStage } from "@/components/marketing/hero";
import { PixelComposition, PixelSprites } from "@/components/marketing/pixel-sprites";
import { SkipToast } from "@/components/marketing/skip-toast";
import { getSession } from "@/lib/auth/session";
import { readEvalReport } from "@/lib/eval-report";

export const metadata = {
  title: { absolute: "BrandLens · Every draft, checked against your brand" },
  description:
    "BrandLens checks posts, pages, images and decks against your approved rules, facts and assets. Every flag cites the rule or fact it was checked against. People approve; BrandLens never publishes.",
};

const BUILT_ON = [
  "Next.js",
  "Supabase",
  "pgvector",
  "FastAPI",
  "PyMuPDF",
  "OpenCV",
  "bge-small",
  "Groq",
  "Gemini",
];

/** Public landing (DESIGN.md §8). Everything on it must be true: no invented customers or stats. */
export default async function Landing() {
  const [session, report] = await Promise.all([getSession().catch(() => null), readEvalReport()]);
  return (
    <>
      {session?.status === "ok" ? <SkipToast /> : null}

      <section aria-label="Introduction" className="blueprint-grid relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--hero-glow)" }}
        />
        <div className="relative mx-auto max-w-[1280px] px-4 pt-16 pb-16 sm:px-6 md:pt-24 lg:pt-28">
          <HeroStage>
            <p className="text-fg-muted max-w-[60ch] text-lg leading-relaxed">
              BrandLens checks each post, page, image and deck against your approved rules, facts
              and assets, and every flag cites the rule or fact it was checked against. People
              approve. BrandLens never publishes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Cta href="/login">Try the demo</Cta>
              <Cta href="#how-it-works" variant="secondary">
                How it works
              </Cta>
            </div>
          </HeroStage>
          <PixelSprites className="bottom-24 left-[55%] hidden h-48 w-80 lg:block" />
          <div className="mt-20">
            <p className="mono-label text-fg-faint mb-3">Built on open, auditable parts</p>
            <ul className="text-fg-muted flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
              {BUILT_ON.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Section
        id="how-it-works"
        eyebrow="Six dimensions · deterministic first"
        title={
          <>
            Catch it <span className="text-gradient-word">before</span> it ships
          </>
        }
      >
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <DimensionSentence />
          <BleedCard />
        </div>
        <div className="mt-20">
          <FeatureCells />
        </div>
      </Section>

      <Section id="guarantees" eyebrow="Guarantees" title="Numbers we hold ourselves to">
        <GuaranteesBand report={report} />
      </Section>

      <Section
        id="evidence"
        eyebrow="Why manual review fails"
        title="Review by re-reading doesn't scale"
      >
        <EvidenceBand />
      </Section>

      <Section
        id="heard"
        eyebrow="From our four discovery interviews, October 2026"
        title="What we heard"
      >
        <HeardCarousel />
      </Section>

      <Section
        id="responsible"
        eyebrow="Responsible design"
        title="Built so you can trust the flags"
      >
        <TrustGrid />
      </Section>

      <section aria-labelledby="final-h" className="border-line relative overflow-hidden border-t">
        <div className="relative mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-24 sm:px-6 lg:py-32">
          <h2
            id="final-h"
            className="max-w-3xl text-[clamp(32px,4vw,52px)] leading-[1.08] font-light tracking-[-0.02em]"
          >
            Stop line-editing. Start citing.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Cta href="/login">Try the demo</Cta>
            <Cta href="/ai-use" variant="secondary">
              Services &amp; AI use
            </Cta>
          </div>
          <PixelComposition className="absolute right-0 bottom-0 hidden opacity-70 md:grid" />
        </div>
      </section>
    </>
  );
}
