import { HowAiWorks, QualityTable, ServiceCells } from "@/components/ai-use/disclosure";
import { readEvalReport } from "@/lib/eval-report";

export const metadata = {
  title: "Services & AI use",
  description: "Every external service BrandLens uses, what it receives, and how AI is involved.",
};

/** Public mirror of /settings/ai-use, without live model data (DESIGN.md §8.9). */
export default async function PublicAiUse() {
  const report = await readEvalReport();
  return (
    <div className="mx-auto max-w-[1280px] space-y-16 px-4 py-16 sm:px-6 lg:py-24">
      <header className="max-w-3xl space-y-4">
        <p className="mono-label text-accent-soft">Transparency</p>
        <h1 className="text-[clamp(36px,5vw,64px)] leading-[1.05] font-light tracking-[-0.03em]">
          Services &amp; AI use
        </h1>
        <p className="text-fg-muted text-lg">
          Every external service BrandLens uses, what it receives, and where AI is involved in a
          review. The demo organisation, PayWise, and all of its data are fictional.
        </p>
      </header>
      <section aria-labelledby="svc-h" className="space-y-6">
        <h2 id="svc-h" className="text-3xl font-light">
          External services
        </h2>
        <ServiceCells />
      </section>
      <section aria-labelledby="how-h" className="space-y-6">
        <h2 id="how-h" className="text-3xl font-light">
          How BrandLens uses AI
        </h2>
        <HowAiWorks />
      </section>
      <section aria-labelledby="q-h" className="space-y-6">
        <h2 id="q-h" className="text-3xl font-light">
          Quality
        </h2>
        <QualityTable report={report} />
      </section>
    </div>
  );
}
