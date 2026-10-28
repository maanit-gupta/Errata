import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { EVAL_REPORT, LICENCE, README, REPO } from "@/components/marketing/links";

const COLS: { head: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    head: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Example", href: "/#example" },
      { label: "Try the demo", href: "/login" },
    ],
  },
  {
    head: "Trust",
    links: [
      { label: "Services & AI use", href: "/ai-use" },
      { label: "How we handle data", href: "/#trust" },
      { label: "Security notes", href: README("security"), external: true },
    ],
  },
  {
    head: "Build",
    links: [
      { label: "GitHub", href: REPO, external: true },
      { label: "README", href: README(), external: true },
      { label: "Eval report", href: EVAL_REPORT, external: true },
      { label: "Licence (AGPL-3.0)", href: LICENCE, external: true },
    ],
  },
];

const linkCls = "text-highlight-fg underline underline-offset-4 hover:decoration-2";

/** Marketing footer (DESIGN.md §5.2): yellow band with an ink bottom bar. */
export function MarketingFooter() {
  return (
    <footer className="bg-highlight text-highlight-fg border-outline border-t-2">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          {/* The mark's paper tile keeps the logo readable on yellow in both themes. */}
          <Wordmark className="text-highlight-fg" />
          <p className="max-w-xs text-[0.9375rem]">
            Every draft checked against your brand. Every flag cited.
          </p>
          <p className="text-sm">Maanit Gupta · Jagpreet Singh · SRMIST</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.head} aria-label={c.head}>
            <h2 className="mb-3 text-base font-bold">{c.head}</h2>
            <ul className="space-y-2 text-[0.9375rem]">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noreferrer" className={linkCls}>
                      {l.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <Link href={l.href} className={linkCls}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="bg-accent text-accent-fg">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-2 px-4 py-3 text-sm sm:px-6">
          <p>PayWise is a fictional demo brand.</p>
          <p>© 2026 BrandLens</p>
        </div>
      </div>
    </footer>
  );
}
