import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import type { BottomCard } from "@/components/shell/app-sidebar";
import { requireSession } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import { getShellData } from "@/lib/shell-data";
import { FLASH_COOKIE, SIDEBAR_COOKIE, TIPCARD_COOKIE } from "@/lib/ui-prefs";
import { can, navGroupsFor, roleLabel } from "@/lib/workflow/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const [jar, shell] = await Promise.all([cookies(), getShellData(session)]);

  const bottomCard: BottomCard =
    jar.get(TIPCARD_COOKIE)?.value === "hidden"
      ? null
      : session.role === "brand_admin"
        ? shell.unclear.length
          ? { kind: "watchlist", unclear: shell.unclear }
          : null
        : can(session.role, "submit_content")
          ? { kind: "tips" }
          : null;

  return (
    <AppShell
      account={{
        displayName: session.displayName,
        email: session.email,
        orgName: session.orgName,
        roleLabel: roleLabel(session.role, session.specialistKind),
      }}
      groups={navGroupsFor(session.role)}
      bottomCard={bottomCard}
      queueCount={shell.queueCount}
      activeRuns={shell.activeRuns}
      collapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      demo={clientEnv.NEXT_PUBLIC_DEMO_MODE}
      canCreate={can(session.role, "submit_content")}
      canVault={can(session.role, "define_vault")}
      reviewer={can(session.role, "approve_or_request_changes")}
      flash={jar.get(FLASH_COOKIE)?.value ?? null}
    >
      {children}
    </AppShell>
  );
}
