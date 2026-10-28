import {
  Accessibility,
  Briefcase,
  ClipboardCheck,
  PenLine,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IconTile } from "@/components/brand/icon-tile";
import { Wordmark } from "@/components/brand/wordmark";
import { LensSpot } from "@/components/illustrations";
import { DEMO_ROLE_BLURB } from "@/lib/auth/demo-roles";
import { DEMO_USERS, type DemoUserKey } from "@/lib/auth/demo-users";
import { signInAsDemo } from "@/lib/auth/actions";
import { clientEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ICON: Record<DemoUserKey, LucideIcon> = {
  admin: ShieldCheck,
  creator: PenLine,
  agency: Briefcase,
  manager: ClipboardCheck,
  legal: Scale,
  a11y: Accessibility,
};

/** /login (DESIGN.md §10.2): pink brand panel, outlined form card, one-click demo roles. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const demoFailed = params.error === "demo";

  return (
    <main id="main" className="grid min-h-dvh flex-1 lg:grid-cols-[5fr_7fr]">
      <section
        aria-labelledby="brand-heading"
        className="bg-band-pink border-outline flex flex-col justify-between gap-10 border-b-2 p-6 sm:p-10 lg:border-r-2 lg:border-b-0 lg:p-14"
      >
        <Link href="/" className="inline-flex w-fit" aria-label="BrandLens home">
          <Wordmark />
        </Link>
        <div className="space-y-6">
          <LensSpot className="w-36" />
          <h1
            id="brand-heading"
            className="max-w-md text-[clamp(32px,4vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]"
          >
            Sign in to check your next draft.
          </h1>
          <p className="text-fg-muted max-w-sm text-lg">Every flag cites its source.</p>
        </div>
        <p className="text-fg-muted text-sm">Demo data is fictional (PayWise).</p>
      </section>

      <div className="flex flex-col justify-center gap-10 p-6 sm:p-10 lg:p-14">
        <section
          aria-labelledby="signin-heading"
          className="border-outline bg-elevated w-full max-w-md rounded-lg border-2 p-6 sm:p-8"
        >
          <h2 id="signin-heading" className="mb-6 text-2xl font-bold tracking-[-0.01em]">
            Sign in
          </h2>
          <LoginForm next={next} />
        </section>

        {clientEnv.NEXT_PUBLIC_DEMO_MODE ? (
          <section aria-labelledby="demo-heading" className="w-full max-w-2xl space-y-4">
            <h2 id="demo-heading" className="text-lg font-bold">
              Try a demo role
            </h2>
            {demoFailed ? (
              <p role="alert" className="text-danger text-sm font-semibold">
                Demo sign-in failed. Is the demo data seeded?
              </p>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {DEMO_USERS.map((user) => (
                <li
                  key={user.key}
                  className="group border-outline bg-elevated hover:bg-highlight has-focus-visible:bg-highlight relative flex items-start gap-3 rounded-lg border-2 p-4 transition-colors duration-100"
                >
                  <IconTile Icon={ICON[user.key]} size="sm" />
                  <div className="min-w-0 space-y-1">
                    <form action={signInAsDemo}>
                      <input type="hidden" name="user" value={user.key} />
                      {/* The whole card is the click target; the button's name stays just the role. */}
                      <button
                        type="submit"
                        className="text-fg group-hover:text-highlight-fg group-has-focus-visible:text-highlight-fg text-left text-[0.9375rem] font-bold after:absolute after:inset-0 after:rounded-lg after:content-['']"
                      >
                        {user.label}
                      </button>
                    </form>
                    <p className="text-fg-muted group-hover:text-highlight-fg group-has-focus-visible:text-highlight-fg text-sm leading-snug">
                      {DEMO_ROLE_BLURB[user.key]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
