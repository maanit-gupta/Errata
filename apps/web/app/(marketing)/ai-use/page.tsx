import { HowAiWorks, QualityTable, ServiceCells } from "@/components/ai-use/disclosure";
import { ShieldSpot } from "@/components/illustrations";
import { readEvalReport } from "@/lib/eval-report";

export const metadata = {
  title: "Services & AI use",
  description: "Every external service Errata uses, what it receives, and how AI is involved.",
};

const h2 = "text-[clamp(26px,3vw,36px)] leading-tight font-semibold tracking-[-0.02em]";

/** Public mirror of /settings/ai-use, without live model data (DESIGN.md §9). */
export default async function PublicAiUse() {
  const report = await readEvalReport();
  return (
    <>
      <section className="bg-band-pink">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:py-20">
          <header className="max-w-2xl space-y-4">
            <h1 className="text-[clamp(36px,5vw,60px)] leading-[1.05] font-semibold tracking-[-0.03em]">
              Services &amp; AI use
            </h1>
            <p className="text-fg-muted text-lg">
              Every service Errata uses and what it receives. PayWise and its data are fictional.
            </p>
          </header>
          <ShieldSpot className="hidden w-40 md:block" />
        </div>
      </section>
      <div className="mx-auto max-w-[1200px] space-y-16 px-4 py-16 sm:px-6 md:py-20">
        <section aria-labelledby="svc-h" className="space-y-6">
          <h2 id="svc-h" className={h2}>
            External services
          </h2>
          <ServiceCells />
        </section>
        <section aria-labelledby="how-h" className="space-y-6">
          <h2 id="how-h" className={h2}>
            How Errata uses AI
          </h2>
          <HowAiWorks />
        </section>
        <section aria-labelledby="q-h" className="max-w-4xl space-y-6">
          <h2 id="q-h" className={h2}>
            Quality
          </h2>
          <QualityTable report={report} />
        </section>
      </div>
    </>
  );
}
