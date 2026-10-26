import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { DemoRoleSwitcher } from "@/components/demo-role-switcher";
import { signOut } from "@/lib/auth/actions";
import { requireSession } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import { navFor, roleLabel } from "@/lib/workflow/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="focus:bg-card sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <header className="border-rule bg-sidebar flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/drafts" className="font-heading text-xl font-semibold">
            Brand<span className="text-accent-text">Lens</span>
          </Link>
          <span className="text-rule hidden sm:inline" aria-hidden>
            /
          </span>
          <p className="flex items-center gap-2 text-sm">
            <span className="font-medium">{session.orgName}</span>
            <span
              data-testid="role-pill"
              className="border-border bg-card rounded-full border px-2 py-0.5 font-mono text-xs"
            >
              {roleLabel(session.role, session.specialistKind)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {clientEnv.NEXT_PUBLIC_DEMO_MODE ? (
            <DemoRoleSwitcher currentEmail={session.email} />
          ) : null}
          <span className="text-muted-foreground hidden text-sm lg:inline">
            {session.displayName}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 rounded-md px-2.5 text-sm font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-rule bg-sidebar border-b px-3 py-3 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:py-6">
          <AppNav items={navFor(session.role)} />
        </aside>
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-8 outline-none sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
