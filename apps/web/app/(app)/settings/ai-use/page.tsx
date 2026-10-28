import { HowAiWorks, QualityTable, ServiceCells } from "@/components/ai-use/disclosure";
import { PageHeader } from "@/components/brand/page-header";
import { readEvalReport } from "@/lib/eval-report";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Services & AI use" };

/** ISO timestamp `days` ago (a request-time server value, not render state). */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function AiUsePage() {
  await requireSession();
  const supabase = await createClient();
  const report = await readEvalReport();
  // Recent runs this user can see (RLS); simulated history isn't a real model call.
  const { data: runs } = await supabase
    .from("review_runs")
    .select("provider, model_version, prompt_version, degraded, finished_at")
    .eq("status", "done")
    .gte("finished_at", daysAgo(30))
    .order("finished_at", { ascending: false })
    .limit(500);
  const byModel = new Map<
    string,
    { key: string; provider: string; model: string; prompt: string; runs: number; last: string }
  >();
  for (const r of runs ?? []) {
    if (!r.provider || r.provider === "simulated" || !r.model_version) continue;
    const key = `${r.provider}|${r.model_version}|${r.prompt_version}`;
    const m = byModel.get(key);
    if (m) m.runs += 1;
    else
      byModel.set(key, {
        key,
        provider: r.provider,
        model: r.model_version,
        prompt: r.prompt_version ?? "–",
        runs: 1,
        last: r.finished_at ?? "",
      });
  }
  const models = [...byModel.values()];
  const degraded = (runs ?? []).filter((r) => r.degraded).length;

  return (
    <>
      <PageHeader
        eyebrow="Workspace · Transparency"
        title="Services & AI use"
        description="Every external service BrandLens uses, what it receives, and how AI is involved in a review."
      />

      <section aria-labelledby="services-heading" className="mb-12 space-y-4">
        <h2 id="services-heading" className="text-2xl">
          External services
        </h2>
        <ServiceCells />
      </section>

      <section aria-labelledby="ai-heading" className="mb-12 space-y-4">
        <h2 id="ai-heading" className="text-2xl">
          How BrandLens uses AI
        </h2>
        <HowAiWorks />
      </section>

      <section aria-labelledby="models-heading" className="mb-12 max-w-4xl space-y-3">
        <h2 id="models-heading" className="text-2xl">
          Models in use
        </h2>
        {models.length ? (
          <div className="border-outline overflow-x-auto rounded-lg border-2">
            <table className="w-full text-sm">
              <caption className="text-fg-faint px-4 py-2 text-left text-xs">
                Reviews in the last 30 days, by provider, model and prompt version
              </caption>
              <thead className="bg-elevated text-left">
                <tr>
                  <th scope="col" className="mono-label text-fg-faint px-4 py-2 font-medium">
                    Provider
                  </th>
                  <th scope="col" className="mono-label text-fg-faint px-4 py-2 font-medium">
                    Model
                  </th>
                  <th scope="col" className="mono-label text-fg-faint px-4 py-2 font-medium">
                    Prompt
                  </th>
                  <th
                    scope="col"
                    className="mono-label text-fg-faint px-4 py-2 text-right font-medium"
                  >
                    Reviews
                  </th>
                  <th scope="col" className="mono-label text-fg-faint px-4 py-2 font-medium">
                    Last used
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.key} className="border-line border-t">
                    <td className="px-4 py-2">{m.provider}</td>
                    <td className="px-4 py-2 font-mono text-xs">{m.model}</td>
                    <td className="px-4 py-2 font-mono text-xs">{m.prompt}</td>
                    <td className="mono-id px-4 py-2 text-right">{m.runs}</td>
                    <td className="mono-id text-fg-muted px-4 py-2">{m.last.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-fg-muted text-sm">
            The models and prompt versions used by recent reviews will be listed here once reviews
            have run.
          </p>
        )}
        {degraded ? (
          <p className="text-sm">
            {degraded} review{degraded === 1 ? "" : "s"} ran deterministic checks only because no
            LLM was available.
          </p>
        ) : null}
        <p className="border-outline text-fg-muted rounded-lg border-2 p-4 text-sm">
          The demo organisation, PayWise, and all of its data are fictional.
        </p>
      </section>

      <section aria-labelledby="quality-heading" className="max-w-4xl space-y-3">
        <h2 id="quality-heading" className="text-2xl">
          Quality
        </h2>
        <QualityTable report={report} />
      </section>
    </>
  );
}
