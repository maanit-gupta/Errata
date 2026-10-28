/**
 * "How it works" demo video (apps/web/video-src, brag-plan.md). Native controls, muted, never
 * autoplays (so reduced-motion users are never surprised), 16:9 box reserved up front so the page
 * doesn't shift, captions track plus a text transcript with the same words as the on-screen text.
 * Keep TRANSCRIPT in sync with public/demo/errata-how-it-works.en.vtt.
 */
const SRC = "/demo/errata-how-it-works";

export const TRANSCRIPT: { at: string; text: string }[] = [
  { at: "0:00", text: "Errata checks every draft against your approved brand rules." },
  {
    at: "0:04",
    text: "A creator writes a caption and sets its intent: goal, audience, call to action, channel and campaign.",
  },
  { at: "0:12", text: "Six steps run. A flag survives only if it cites an approved rule or fact." },
  {
    at: "0:19",
    text: "CL-03: “assured returns” on a market-linked fund, quoting F-112 without its disclaimer.",
  },
  {
    at: "0:24",
    text: "E-19: Oct 18 at Hall B belongs to another campaign. Caught without AI judgement.",
  },
  { at: "0:29", text: "G-07: the brand is written PayWise, not “Paywise app”." },
  { at: "0:34", text: "WCAG 1.4.3: poster text at 2.89 : 1. Large text needs 3 : 1." },
  { at: "0:39", text: "Fixes keep your intent. AI rewrites are re-checked before you see them." },
  { at: "0:45", text: "The claim goes to Legal, who signs off with a reason." },
  { at: "0:51", text: "The audit trail records who decided, when and why." },
  { at: "0:55", text: "Humans approve. Errata never publishes." },
];

export function DemoVideo() {
  return (
    <figure className="mx-0 mt-0 space-y-4">
      <div className="border-outline bg-elevated aspect-video w-full overflow-hidden rounded-lg border-2">
        <video
          className="block h-full w-full"
          controls
          muted
          playsInline
          preload="metadata"
          poster={`${SRC}-poster.jpg`}
          width={1920}
          height={1080}
          aria-label="Errata demo, 60 seconds, no sound: a caption is checked, flagged with cited rules, fixed and signed off by Legal"
        >
          <source src={`${SRC}.webm`} type="video/webm" />
          <source src={`${SRC}.mp4`} type="video/mp4" />
          <track kind="captions" src={`${SRC}.en.vtt`} srcLang="en" label="English" />
          Your browser can&apos;t play this video. The transcript below has the same content.
        </video>
      </div>
      <figcaption>
        <details className="group">
          <summary className="text-fg inline-flex cursor-pointer items-center gap-2 text-[0.9375rem] font-semibold underline underline-offset-4">
            Read the transcript
          </summary>
          <ol className="mt-4 space-y-2 text-[0.9375rem]">
            {TRANSCRIPT.map((t) => (
              <li key={t.at} className="flex gap-4">
                <span className="mono-id text-fg-muted w-10 shrink-0 pt-0.5">{t.at}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ol>
        </details>
      </figcaption>
    </figure>
  );
}
