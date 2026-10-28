import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand/page-header";
import { AppShell } from "@/components/shell/app-shell";
import { navGroupsFor } from "@/lib/workflow/permissions";
import { FindingCardsDemo, TableDemo } from "../kitchen-sink/interactive";

export const metadata = { title: "Shell preview" };

/**
 * Dev-only preview of the signed-in app shell with mock data (DESIGN.md §13), so the sidebar,
 * top bar, demo strip and account menu can be checked without a database. Not served in
 * production.
 */
export default function ShellPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      account={{
        displayName: "Rohan (Creator)",
        email: "admin@paywise.demo",
        orgName: "PayWise",
        roleLabel: "Brand admin",
      }}
      groups={navGroupsFor("brand_admin")}
      queueCount={7}
      activeRuns={{ count: 1, href: null }}
      collapsed={false}
      demo
      canCreate
      canVault
      reviewer
      flash={null}
    >
      <PageHeader title="Drafts" description="Your drafts and where each one stands." />
      <div className="space-y-8">
        <TableDemo />
        <div className="max-w-2xl">
          <FindingCardsDemo />
        </div>
      </div>
    </AppShell>
  );
}
