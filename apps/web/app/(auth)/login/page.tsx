import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { signInAsDemo } from "@/lib/auth/actions";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const demoFailed = params.error === "demo";

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-6 py-16 md:grid-cols-[1.1fr_1fr]">
      <section aria-labelledby="brand-heading" className="space-y-6">
        <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
          Pre-publication brand governance
        </p>
        <h1 id="brand-heading" className="font-heading text-5xl leading-[1.05] sm:text-6xl">
          Brand<span className="text-accent-text">Lens</span>
        </h1>
        <p className="text-muted-foreground max-w-md text-lg">
          Every draft checked against your approved rule cards and facts. Every flag cites the rule
          it broke. Humans approve; BrandLens never publishes.
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          <span className="border-foreground/25 text-foreground rounded-sm border px-1.5 py-0.5">
            CL-03
          </span>{" "}
          · BLOCKER · “assured returns” on a market-linked product
        </p>
      </section>

      <div className="space-y-8">
        <section
          aria-labelledby="signin-heading"
          className="border-border bg-card rounded-xl border p-6 shadow-sm sm:p-8"
        >
          <h2 id="signin-heading" className="font-heading mb-6 text-2xl">
            Sign in
          </h2>
          <LoginForm next={next} />
        </section>

        {clientEnv.NEXT_PUBLIC_DEMO_MODE ? (
          <section
            aria-labelledby="demo-heading"
            className="border-border rounded-xl border border-dashed p-6"
          >
            <h2 id="demo-heading" className="font-heading text-xl">
              Try a demo role
            </h2>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              One click signs you in as a seeded user in the fictional PayWise org.
            </p>
            {demoFailed ? (
              <p role="alert" className="text-accent-text mb-3 text-sm">
                Demo sign-in failed. Is the demo data seeded?
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO_USERS.map((user) => (
                <li key={user.key}>
                  <form action={signInAsDemo}>
                    <input type="hidden" name="user" value={user.key} />
                    <button
                      type="submit"
                      className="border-border bg-card hover:border-foreground/40 hover:bg-muted w-full rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors"
                    >
                      {user.label}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
