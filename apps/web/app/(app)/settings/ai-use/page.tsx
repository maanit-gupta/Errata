import { PageHeader } from "@/components/brand/page-header";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Services and AI use" };

type Service = { name: string; purpose: string; receives: string; stance: string };

// SPEC §18. Keep in sync with CLAUDE.md "Deliberate deviations".
const SERVICES: Service[] = [
  {
    name: "Groq",
    purpose: "Primary LLM for judgement checks (tone, claims) and rewrites",
    receives: "One redacted draft chunk plus the top-k retrieved rule and fact snippets per review",
    stance: "Does not train on API data.",
  },
  {
    name: "Google Gemini (free tier)",
    purpose: "Fallback LLM when Groq is unavailable",
    receives: "Same minimal payload as Groq, only when the fallback is used",
    stance:
      "The free tier may use prompts to improve Google products. The demo therefore uses fictional data only.",
  },
  {
    name: "Langfuse Cloud",
    purpose: "Tracing of LLM calls (latency, tokens, prompt version)",
    receives: "Prompts and responses of LLM calls, i.e. the same redacted payloads",
    stance: "Retained in our Langfuse project; traces contain fictional PayWise data only.",
  },
  {
    name: "Supabase (Mumbai)",
    purpose: "Database, auth, file storage and realtime updates",
    receives: "All app data: drafts, findings, vault, audit log",
    stance: "Our project; row-level security on every organisation table. No training.",
  },
  {
    name: "Vercel",
    purpose: "Hosts the web app",
    receives: "Web requests and server-rendered pages",
    stance: "Hosting only. No training.",
  },
  {
    name: "Worker host (Railway or Fly)",
    purpose: "Runs the review pipeline container",
    receives: "Jobs and the drafts they review",
    stance: "Hosting only. No training.",
  },
  {
    name: "Discord",
    purpose: "Review notifications",
    receives: "Content title, state change and a link; never the draft text",
    stance: "Messages kept in our Discord channel.",
  },
  {
    name: "Resend (optional)",
    purpose: "Email notifications when enabled",
    receives: "Recipient email, content title and a link",
    stance: "Disabled unless an API key is configured.",
  },
];

/** ISO timestamp `days` ago (a request-time server value, not render state). */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function AiUsePage() {
  await requireSession();
  const supabase = await createClient();
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
        eyebrow="Settings · Transparency"
        title="Services and AI use"
        description="Every external service BrandLens uses, what it receives, and how AI is involved in a review."
      />

      <section aria-labelledby="services-heading" className="mb-12">
        <h2 id="services-heading" className="font-heading mb-4 text-2xl">
          External services
        </h2>
        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">External services and the data each receives</caption>
            <thead className="border-border bg-muted/60 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Service
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Used for
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Receives
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Retention and training
                </th>
              </tr>
            </thead>
            <tbody>
              {SERVICES.map((s) => (
                <tr key={s.name} className="border-border border-b align-top last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {s.name}
                  </th>
                  <td className="px-4 py-3">{s.purpose}</td>
                  <td className="px-4 py-3">{s.receives}</td>
                  <td className="px-4 py-3">{s.stance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ai-heading" className="mb-12 max-w-3xl space-y-4">
        <h2 id="ai-heading" className="font-heading text-2xl">
          How AI is used in a review
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Anything checkable without a model (glossary, facts, dates, venues, fees, contrast,
            colour, logo) is checked deterministically first. It is never sent to an LLM.
          </li>
          <li>
            One LLM call per draft handles the judgement dimensions (for a PDF, one per chunk of
            whole pages). A second sample is taken only to confirm blocker-severity findings.
          </li>
          <li>
            Only the redacted draft chunk and the top-k retrieved snippets are sent. Personal data
            the redactor catches and vault items marked “never send” are never sent.
          </li>
          <li>
            Every finding cites a rule, fact or WCAG criterion. A finding whose citation or quote
            can&apos;t be verified locally is dropped, never shown.
          </li>
          <li>
            Findings that came from an LLM carry an <strong>AI-assisted</strong> label and record
            the model and prompt version.
          </li>
          <li>Humans decide. BrandLens never publishes anything.</li>
        </ul>
      </section>

      <section aria-labelledby="models-heading" className="max-w-3xl space-y-3">
        <h2 id="models-heading" className="font-heading text-2xl">
          Models and prompt versions
        </h2>
        {models.length ? (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="text-muted-foreground px-4 py-2 text-left text-xs">
                Reviews in the last 30 days, by provider, model and prompt version
              </caption>
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Provider
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Model
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Prompt
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Reviews
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Last used
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.key} className="border-border border-t">
                    <td className="px-4 py-2">{m.provider}</td>
                    <td className="px-4 py-2 font-mono text-xs">{m.model}</td>
                    <td className="px-4 py-2 font-mono text-xs">{m.prompt}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.runs}</td>
                    <td className="px-4 py-2">{m.last.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">
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
        <p className="border-border rounded-md border border-dashed p-4 text-sm">
          The demo organisation, PayWise, and all of its data are fictional.
        </p>
      </section>
    </>
  );
}
