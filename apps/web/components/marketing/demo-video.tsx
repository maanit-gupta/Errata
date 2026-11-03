/**
 * "How it works" demo video, Round 3 cut (source: apps/web/video-src/round3, storyboard:
 * docs/video/README.md). Native controls, muted, never autoplays (so reduced-motion users are never
 * surprised), 16:9 box reserved up front so the page doesn't shift, captions track plus a text
 * transcript with the same words as the on-screen text.
 * Keep TRANSCRIPT in sync with public/demo/errata-whats-new.en.vtt (checked by a unit test).
 */
const SRC = "/demo/errata-whats-new";

export const VTT_PATH = `public${SRC}.en.vtt`;

export const TRANSCRIPT: { at: string; text: string }[] = [
  {
    at: "0:00",
    text: "Errata checks every draft against your approved brand rules and cites the rule behind every flag.",
  },
  {
    at: "0:04",
    text: "A creator writes a caption and sets its intent: goal, audience, call to action, channel and campaign.",
  },
  { at: "0:10", text: "Six steps run. A flag survives only if it cites an approved rule or fact." },
  {
    at: "0:15",
    text: "CL-03: “assured returns” on a market-linked fund, quoting F-112 without its disclaimer.",
  },
  {
    at: "0:20",
    text: "E-19: Oct 18 at Hall B belongs to another campaign. Caught without AI judgement.",
  },
  { at: "0:25", text: "New since Round 2: six features, each one shown next." },
  {
    at: "0:30",
    text: "If the AI provider is busy, rule-based findings show at once and the AI check retries by itself.",
  },
  {
    at: "0:37",
    text: "The image says Oct 18, the caption says Oct 28. Fact E-19 says Oct 28, so the image is flagged.",
  },
  {
    at: "0:44",
    text: "Low-contrast text gets the closest colour from your own palette that passes. Nothing changes until a person accepts it.",
  },
  {
    at: "0:51",
    text: "Claims go to Legal, who signs off with a reason. Every decision is audited.",
  },
  {
    at: "0:58",
    text: "At publish-ready, Errata issues a receipt: a hash of the approved text and the facts it relies on.",
  },
  {
    at: "1:02",
    text: "If one of those facts changes or expires, approval is revoked and the draft goes back for revision.",
  },
  {
    at: "1:06",
    text: "Unclear rules get better examples. A backtest on recent real reviews projects the effect before anyone approves them.",
  },
  {
    at: "1:13",
    text: "Claude or Cursor can fetch live campaign facts and pre-check drafts, with a personal read-only key.",
  },
  { at: "1:21", text: "Humans approve. Errata never publishes." },
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
          aria-label="Errata demo, 87 seconds, no sound: a caption is checked and flagged with cited rules, then the six Round 3 features are shown one by one"
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
