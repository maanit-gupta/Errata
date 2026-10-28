import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import { getShellData } from "@/lib/shell-data";
import { FLASH_COOKIE, SIDEBAR_COOKIE } from "@/lib/ui-prefs";
import { can, navGroupsFor, roleLabel } from "@/lib/workflow/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const [jar, shell] = await Promise.all([cookies(), getShellData(session)]);

  return (
    <AppShell
      account={{
        displayName: session.displayName,
        email: session.email,
        orgName: session.orgName,
        roleLabel: roleLabel(session.role, session.specialistKind),
      }}
      groups={navGroupsFor(session.role)}
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
