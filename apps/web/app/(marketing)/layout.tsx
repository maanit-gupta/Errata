import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { getSession } from "@/lib/auth/session";
import { ANNOUNCE_COOKIE } from "@/lib/ui-prefs";

/** Public pages (DESIGN.md §8): announcement bar, sticky nav, footer, fixed theme toggle. */
export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const [session, jar] = await Promise.all([getSession().catch(() => null), cookies()]);
  const signedIn = session?.status === "ok";
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-accent text-accent-fg sr-only z-[60] px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AnnouncementBar hidden={jar.get(ANNOUNCE_COOKIE)?.value === "hidden"} />
      <MarketingNav signedIn={signedIn} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <MarketingFooter />
      <ThemeToggle className="bg-canvas fixed right-4 bottom-4 z-40 rounded-none" />
    </div>
  );
}
