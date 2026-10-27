import Link from "next/link";
import { EVAL_REPORT, LICENCE, README, REPO } from "@/components/marketing/links";
import { PixelComposition } from "@/components/marketing/pixel-sprites";

const COLS: { head: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    head: "PRODUCT",
    links: [
      { label: "Checks", href: "/#checks" },
      { label: "Workflow", href: "/#how-it-works" },
      { label: "Insights", href: "/#insights" },
    ],
  },
  {
    head: "TRUST",
    links: [
      { label: "Responsible AI", href: "/#responsible" },
      { label: "Services & AI use", href: "/ai-use" },
      { label: "Security notes", href: README("security"), external: true },
    ],
  },
  {
    head: "BUILD",
    links: [
      { label: "GitHub", href: REPO, external: true },
      { label: "README", href: README(), external: true },
      { label: "Eval report", href: EVAL_REPORT, external: true },
      { label: "Licence AGPL-3.0", href: LICENCE, external: true },
    ],
  },
];

/** Marketing footer (DESIGN.md §8.11). */
export function MarketingFooter() {
  return (
    <footer className="border-line relative overflow-hidden border-t">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 pt-16 pb-40 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {COLS.map((c) => (
          <nav key={c.head} aria-label={c.head.toLowerCase()}>
            <p className="mono-label text-fg-faint mb-3">{c.head}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fg-faint hover:text-fg"
                    >
                      {l.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <Link href={l.href} className="text-fg-faint hover:text-fg">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <p className="mono-label text-fg-faint mb-3">TEAM</p>
          <ul className="text-fg-faint space-y-2 text-sm">
            <li>Maanit Gupta · AI &amp; backend</li>
            <li>Jagpreet Singh · Product &amp; UX</li>
            <li>SRMIST</li>
          </ul>
        </div>
      </div>
      <PixelComposition className="absolute -bottom-2 -left-4 opacity-90" />
      <div className="border-line relative mx-auto flex max-w-[1280px] flex-wrap justify-between gap-2 border-t px-4 py-4 text-xs sm:px-6">
        <p className="text-fg-faint bg-canvas">
          Demo brand PayWise and its data are fictional. Product names are trademarks of their
          owners.
        </p>
        <p className="text-fg-faint bg-canvas">© BrandLens 2026</p>
      </div>
    </footer>
  );
}
