import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/brand/page-header";
import { ThemeRadioCards } from "@/components/brand/theme-toggle";
import { DiscordTestButton, LandingToggle, ShortcutsToggle } from "@/components/settings/client";
import { McpIntegration, type McpKeyRow } from "@/components/settings/mcp-integration";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { clientEnv, serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getThemeChoice } from "@/lib/theme";
import { SKIP_LANDING_COOKIE } from "@/lib/ui-prefs";
import { roleLabel, type Role } from "@/lib/workflow/permissions";

export const metadata = { title: "Settings" };

function Cell({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="border-outline bg-elevated grid scroll-mt-20 gap-4 rounded-lg border-2 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
    >
      <div className="space-y-1">
        <h2 id={`${id}-h`} className="text-lg">
          {title}
        </h2>
        <p className="text-fg-muted text-sm">{description}</p>
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}

/** Settings (DESIGN.md §6.9): bordered section cards with a sticky anchor nav at ≥lg. */
export default async function SettingsPage() {
  const session = await requireSession();
  const [theme, jar] = await Promise.all([getThemeChoice(), cookies()]);
  const env = serverEnv();
  const admin = session.role === "brand_admin";
  const demo = clientEnv.NEXT_PUBLIC_DEMO_MODE;

  const supabase = await createClient();
  const [{ data: members }, { data: profiles }] = admin
    ? await Promise.all([
        supabase
          .from("memberships")
          .select("user_id, role, specialist_kind")
          .eq("org_id", session.orgId),
        supabase.from("profiles").select("id, display_name"),
      ])
    : [{ data: null }, { data: null }];
  const name = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "—"]));

  // AI tools (MCP): every member manages their own keys; RLS also shows brand admins every key
  // in the org. key_hash is never selected (and isn't readable by app users anyway).
  const { data: keyRows } = await supabase
    .from("mcp_api_keys")
    .select("id, user_id, name, key_prefix, created_at, last_used_at, expires_at, revoked_at")
    .eq("org_id", session.orgId)
    .order("created_at", { ascending: false });
  const renderedAt = new Date().toISOString();
  const mcpKeys: McpKeyRow[] = (keyRows ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    owner: name.get(k.user_id) ?? null,
    mine: k.user_id === session.userId,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    expiresAt: k.expires_at,
    revokedAt: k.revoked_at,
    expired: k.expires_at <= renderedAt,
  }));
  const mcpEndpoint = `${(env.WORKER_URL ?? "https://<worker-url>").replace(/\/+$/, "")}/v1/mcp`;

  const sections = [
    ["profile", "Profile"],
    ["appearance", "Appearance"],
    ["notifications", "Notifications"],
    ["ai-tools", "AI tools (MCP)"],
    ...(admin ? [["organisation", "Organisation"]] : []),
    ...(demo ? [["demo", "Demo"]] : []),
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, how Errata looks, and how it tells people about reviews."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-4">
          <Cell id="profile" title="Profile" description="Who you are in this workspace.">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-fg-faint">Name</dt>
              <dd>{session.displayName}</dd>
              <dt className="text-fg-faint">Email</dt>
              <dd>{session.email}</dd>
              <dt className="text-fg-faint">Organisation</dt>
              <dd>{session.orgName}</dd>
              <dt className="text-fg-faint">Role</dt>
              <dd>
                <span className="mono-label border-line-strong rounded-sm border px-1.5 py-0.5">
                  {roleLabel(session.role, session.specialistKind)}
                </span>
              </dd>
            </dl>
          </Cell>
          <Cell
            id="appearance"
            title="Appearance"
            description="Theme and shortcuts are saved in this browser."
          >
            <ThemeRadioCards initial={theme} />
            <LandingToggle skipping={jar.get(SKIP_LANDING_COOKIE)?.value === "1"} />
            <ShortcutsToggle />
          </Cell>
          <Cell
            id="notifications"
            title="Notifications"
            description="Where review updates go. Messages carry titles and links, never draft text."
          >
            <p className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-20">Discord</span>
              {env.DISCORD_WEBHOOK_URL ? (
                <span className="text-success inline-flex items-center gap-1.5">
                  <span aria-hidden className="bg-success size-1.5 rounded-full" /> Connected
                </span>
              ) : (
                <span className="text-fg-faint">Not configured</span>
              )}
              {admin && env.DISCORD_WEBHOOK_URL ? <DiscordTestButton /> : null}
            </p>
            <p className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-20">Email</span>
              {env.RESEND_API_KEY ? (
                <span className="text-success">Enabled</span>
              ) : (
                <span className="text-fg-faint">Disabled (no RESEND_API_KEY)</span>
              )}
            </p>
          </Cell>
          <Cell
            id="ai-tools"
            title="AI tools (MCP)"
            description={
              <>
                Let Cursor or Claude draft from this organisation&apos;s live facts and approved
                rules, and pre-check copy before it reaches Errata. Read-only, with your role.{" "}
                <a
                  href="https://github.com/maanit-gupta/Errata/blob/main/docs/MCP.md"
                  className="text-accent-soft underline underline-offset-4"
                >
                  Setup guide
                </a>
              </>
            }
          >
            <McpIntegration keys={mcpKeys} endpoint={mcpEndpoint} canRevokeOthers={admin} />
          </Cell>
          {admin ? (
            <Cell
              id="organisation"
              title="Organisation"
              description="Members of this workspace. Inviting people isn't in this build."
            >
              <ul className="divide-line border-outline divide-y rounded-lg border-2 text-sm">
                {(members ?? []).map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>{name.get(m.user_id) ?? "—"}</span>
                    <span className="mono-label border-line-strong text-fg-muted rounded-sm border px-1.5 py-0.5">
                      {roleLabel(m.role as Role, m.specialist_kind)}
                    </span>
                  </li>
                ))}
              </ul>
            </Cell>
          ) : null}
          {demo ? (
            <Cell id="demo" title="Demo" description="PayWise and all of its data are fictional.">
              <Button variant="danger" disabled focusableWhenDisabled aria-describedby="reset-help">
                Reset demo data
              </Button>
              <p id="reset-help" className="text-fg-faint text-xs">
                Run by the team, not from the UI:{" "}
                <code className="mono-id">scripts/reset_demo.sh</code>
              </p>
            </Cell>
          ) : null}
          <p className="text-fg-muted text-sm">
            <Link href="/settings/ai-use" className="text-accent-soft underline underline-offset-4">
              Services &amp; AI use
            </Link>{" "}
            lists every external service, what it receives, and the models in use.
          </p>
        </div>
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-sm">
            {sections.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-fg-muted hover:bg-hover hover:text-fg block rounded-md px-2 py-1.5"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
