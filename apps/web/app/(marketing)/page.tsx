import {
  BleedExample,
  FeaturedDemo,
  Hero,
  Section,
  Steps,
  TrustPoints,
} from "@/components/marketing/sections";
import { SkipToast } from "@/components/marketing/skip-toast";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: { absolute: "Errata · Every draft, checked before it ships" },
  description:
    "Errata checks posts, decks and images against your approved rules and facts. Every flag cites its source. People approve; Errata never publishes.",
};

/** Public landing (DESIGN.md §9). Everything on it must be true: no invented customers or stats. */
export default async function Landing() {
  const session = await getSession().catch(() => null);
  return (
    <>
      {session?.status === "ok" ? <SkipToast /> : null}
      <Hero />
      <Section
        id="how-it-works"
        band="grey"
        angled
        title="How it works"
        intro="Three steps from brand guide to approved post."
      >
        <Steps />
      </Section>
      <section id="example" aria-labelledby="example-h" className="scroll-mt-24">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 md:py-24">
          <BleedExample />
        </div>
      </section>
      <Section id="trust" band="pink" title="Built so you can trust the flags">
        <TrustPoints />
      </Section>
      <section aria-labelledby="demo-h" className="bg-band-grey">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 md:py-24">
          <FeaturedDemo />
        </div>
      </section>
    </>
  );
}
