import { ThemeToggle } from "@/components/brand/theme-toggle";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { getSession } from "@/lib/auth/session";

/** Public pages (DESIGN.md §9): sticky nav, yellow footer, fixed theme toggle. */
export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const session = await getSession().catch(() => null);
  const signedIn = session?.status === "ok";
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-accent text-accent-fg sr-only z-[60] rounded-sm px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <MarketingNav signedIn={signedIn} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <MarketingFooter />
      <ThemeToggle className="bg-elevated fixed right-4 bottom-4 z-40" />
    </div>
  );
}
