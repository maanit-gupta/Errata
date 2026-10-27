import { ExternalLink } from "lucide-react";
import type { EvalSummary } from "@/lib/eval-report";
import { cn } from "@/lib/utils";

type Service = {
  name: string;
  purpose: string;
  receives: string;
  stance: string;
  policy: string;
  warning?: string;
};

// SPEC §18. Keep in sync with CLAUDE.md "Deliberate deviations" and PROGRESS decisions.
export const SERVICES: Service[] = [
  {
    name: "Groq",
    purpose: "Primary LLM for judgement checks (tone, claims) and rewrites.",
    receives:
      "One redacted draft chunk plus the top-k retrieved rule and fact snippets per review.",
    stance: "Does not train on API data.",
    policy: "https://groq.com/privacy-policy",
  },
  {
    name: "Gemini",
    purpose: "Fallback LLM when Groq is unavailable.",
    receives: "The same minimal payload as Groq, only when the fallback is used.",
    stance: "Free tier.",
    policy: "https://ai.google.dev/gemini-api/terms",
    warning:
      "Free tier: prompts may be used to improve Google products. The demo uses fictional data only.",
  },
  {
    name: "Langfuse Cloud",
    purpose: "Tracing of LLM calls: latency, tokens, prompt version.",
    receives: "Run ids, counts and versions. No draft text or prompts are logged.",
    stance: "Kept in our Langfuse project.",
    policy: "https://langfuse.com/privacy",
  },
  {
    name: "Supabase",
    purpose: "Database, auth, file storage and realtime updates (Singapore region).",
    receives: "All app data: drafts, findings, vault, audit log.",
    stance: "Our project. Row-level security on every organisation table. No training.",
    policy: "https://supabase.com/privacy",
  },
  {
    name: "Vercel",
    purpose: "Hosts the web app.",
    receives: "Web requests and server-rendered pages.",
    stance: "Hosting only. No training.",
    policy: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Worker host (Render)",
    purpose: "Runs the review pipeline container, including local embeddings and OCR.",
    receives: "Jobs and the drafts they review.",
    stance: "Hosting only. No training.",
    policy: "https://render.com/privacy",
  },
  {
    name: "Discord",
    purpose: "Review notifications.",
    receives: "Content title, state change and a link. Never the draft text.",
    stance: "Messages kept in our Discord channel.",
    policy: "https://discord.com/privacy",
  },
  {
    name: "Resend",
    purpose: "Email notifications, when enabled.",
    receives: "Recipient email, content title and a link.",
    stance: "Disabled unless an API key is configured.",
    policy: "https://resend.com/legal/privacy-policy",
  },
];

/** One bordered cell per external service (DESIGN.md §6.10). */
export function ServiceCells() {
  return (
    <ul className="border-line bg-line grid gap-px border md:grid-cols-2">
      {SERVICES.map((s) => (
        <li key={s.name} className="bg-elevated space-y-3 p-5">
          <h3 className="text-lg">{s.name}</h3>
          <p className="text-fg-muted text-sm">{s.purpose}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="mono-label text-fg-faint pt-0.5">Receives</dt>
            <dd>{s.receives}</dd>
            <dt className="mono-label text-fg-faint pt-0.5">Retention / training</dt>
            <dd>{s.stance}</dd>
          </dl>
          {s.warning ? (
            <p className="border-warning bg-warning-bg text-warning border px-3 py-2 text-sm">
              {s.warning}
            </p>
          ) : null}
          <a
            href={s.policy}
            target="_blank"
            rel="noreferrer"
            className="text-accent-soft inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            {s.name} policy <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const STAGES: [string, string, "LOCAL" | "EXTERNAL", string][] = [
  ["01", "Ingest", "LOCAL", "Parse text, DOCX, images and PDFs into spans and boxes."],
  [
    "02",
    "Protect",
    "LOCAL",
    "Redact PII and secrets; drop never-send vault items; strip hidden text.",
  ],
  [
    "03",
    "Filters",
    "LOCAL",
    "Glossary, Fact Vault, claims lexicon, readability, contrast, colour, logo.",
  ],
  [
    "04",
    "Retrieve",
    "LOCAL",
    "bge-small embeddings + pgvector top-k over approved rules and facts.",
  ],
  [
    "05",
    "LLM pass",
    "EXTERNAL",
    "One structured call for tone and claims, conditioned on your intent.",
  ],
  [
    "06",
    "Citation gate",
    "LOCAL",
    "Keep a finding only if its citation was retrieved and its quote is in the draft.",
  ],
];

/** "How BrandLens uses AI" (DESIGN.md §6.10). */
export function HowAiWorks() {
  return (
    <div className="space-y-6">
      <ol className="border-line bg-line grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map(([n, name, where, body]) => (
          <li key={n} className="bg-elevated space-y-2 p-4">
            <p className="flex items-center justify-between">
              <span className="mono-label text-fg-faint">
                {n} {name}
              </span>
              <span
                className={cn(
                  "mono-label border px-1.5 py-0.5",
                  where === "LOCAL" ? "border-success text-success" : "border-warning text-warning",
                )}
              >
                {where}
              </span>
            </p>
            <p className="text-fg-muted text-sm">{body}</p>
          </li>
        ))}
      </ol>
      <ul className="text-fg-muted list-disc space-y-2 pl-5 text-sm">
        <li>
          Anything checkable without a model is checked deterministically and never sent to an LLM.
        </li>
        <li>
          One LLM call per draft (per page chunk for PDFs). A second sample only confirms blockers.
        </li>
        <li>
          LLM findings carry an <span className="mono-label text-accent-soft">AI-ASSISTED</span>{" "}
          label and record the model and prompt version.
        </li>
        <li>No uncited finding is ever shown.</li>
        <li>Nothing is published automatically. People approve; BrandLens never publishes.</li>
      </ul>
    </div>
  );
}

/** "Quality" (DESIGN.md §6.10): per-dimension precision/recall from the P14 golden set. */
export function QualityTable({ report }: { report: EvalSummary | null }) {
  if (!report)
    return (
      <p className="text-fg-muted border-line border p-4 text-sm">
        The golden-set evaluation (P14) hasn&apos;t been committed to this build yet. Dimensions
        under 85% precision will ship as suggestions only.
      </p>
    );
  return (
    <div className="space-y-2">
      <div className="border-line overflow-x-auto border">
        <table className="w-full text-sm">
          <caption className="text-fg-faint px-4 py-2 text-left text-xs">
            Golden set of {report.rows} drafts, {report.generatedAt.slice(0, 10)}
          </caption>
          <thead className="bg-elevated">
            <tr className="border-line border-y">
              {["Dimension", "Precision", "Recall", "Max severity"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "mono-label text-fg-faint h-9 px-4 font-medium",
                    i && i < 3 ? "text-right" : "text-left",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.dimensions.map((d) => (
              <tr key={d.dimension} className="border-line border-b last:border-0">
                <th scope="row" className="mono-label px-4 py-2 text-left font-medium">
                  {d.dimension}
                </th>
                <td className="mono-id px-4 py-2 text-right">{d.precision.toFixed(2)}</td>
                <td className="mono-id px-4 py-2 text-right">{d.recall.toFixed(2)}</td>
                <td className="px-4 py-2">
                  {d.capped ? (
                    <span className="mono-label border-warning text-warning border px-1.5 py-0.5">
                      CAPPED · precision {d.precision.toFixed(2)}
                    </span>
                  ) : (
                    <span className="mono-label text-fg-muted">{d.maxSeverity}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
