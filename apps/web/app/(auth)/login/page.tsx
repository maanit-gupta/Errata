import type { Metadata } from "next";
import Link from "next/link";
import { PixelGlyph, type GlyphName } from "@/components/brand/pixel-glyphs";
import { Wordmark } from "@/components/brand/wordmark";
import { DEMO_ROLE_BLURB } from "@/lib/auth/demo-roles";
import { DEMO_USERS, type DemoUserKey } from "@/lib/auth/demo-users";
import { signInAsDemo } from "@/lib/auth/actions";
import { clientEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const GLYPH: Record<DemoUserKey, GlyphName> = {
  admin: "id-badge",
  creator: "shield-check",
  agency: "lock",
  manager: "stamp",
  legal: "scale",
  a11y: "eye",
};

/** /login (DESIGN.md §6.1): blueprint split, bordered form cell, one-click demo roles. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const demoFailed = params.error === "demo";

  return (
    <main id="main" className="grid min-h-dvh flex-1 lg:grid-cols-12">
      <section
        aria-labelledby="brand-heading"
        className="blueprint-grid border-line relative flex flex-col justify-between gap-12 overflow-hidden border-b p-6 sm:p-10 lg:col-span-7 lg:border-r lg:border-b-0 lg:p-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--hero-glow)" }}
        />
        <Link href="/" className="relative inline-flex w-fit" aria-label="BrandLens home">
          <Wordmark />
        </Link>
        <div className="relative space-y-6">
          <PixelGlyph name="lens" size={64} />
          <h1
            id="brand-heading"
            className="max-w-xl text-[clamp(36px,4.5vw,64px)] leading-[1.05] font-light tracking-[-0.03em]"
          >
            Sign in to check your next draft.
          </h1>
          <p className="text-fg-muted max-w-md">
            Every flag cites the rule or fact it was checked against. People approve; BrandLens
            never publishes.
          </p>
          <p className="mono-id text-fg-muted flex flex-wrap items-center gap-2">
            <span className="text-accent-soft border-line-strong rounded-sm border px-1.5 py-0.5">
              CL-03
            </span>
            <span className="mono-label bg-blocker text-blocker-fg rounded-sm px-1.5 py-0.5">
              BLOCKER
            </span>
            “assured returns” on a market-linked product
          </p>
        </div>
        <p className="mono-label text-fg-faint relative">Pre-publication brand governance</p>
      </section>

      <div className="flex flex-col justify-center gap-8 p-6 sm:p-10 lg:col-span-5 lg:p-12">
        <section
          aria-labelledby="signin-heading"
          className="border-line bg-elevated rounded-md border p-6 sm:p-8"
        >
          <h2 id="signin-heading" className="mb-6 text-2xl">
            Sign in
          </h2>
          <LoginForm next={next} />
        </section>

        {clientEnv.NEXT_PUBLIC_DEMO_MODE ? (
          <section aria-labelledby="demo-heading" className="space-y-3">
            <h2 id="demo-heading" className="mono-label text-accent-soft">
              Try a demo role
            </h2>
            {demoFailed ? (
              <p role="alert" className="text-danger text-sm">
                Demo sign-in failed. Is the demo data seeded?
              </p>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {DEMO_USERS.map((user) => (
                <li
                  key={user.key}
                  className="border-line-strong bg-elevated hover:border-accent has-focus-visible:border-accent relative flex flex-col gap-2 rounded-md border p-3 transition-colors"
                >
                  <PixelGlyph name={GLYPH[user.key]} size={24} />
                  <form action={signInAsDemo}>
                    <input type="hidden" name="user" value={user.key} />
                    {/* The whole card is the click target; the button's name stays just the role. */}
                    <button
                      type="submit"
                      className="text-fg text-left text-sm font-medium after:absolute after:inset-0 after:content-['']"
                    >
                      {user.label}
                    </button>
                  </form>
                  <p className="text-fg-muted text-xs leading-snug">{DEMO_ROLE_BLURB[user.key]}</p>
                </li>
              ))}
            </ul>
            <p className="text-fg-faint text-xs">Demo data is fictional (PayWise).</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
