import Link from "next/link";
import { PageHeader } from "@/components/brand/page-header";
import { requireSession } from "@/lib/auth/session";
import { roleLabel } from "@/lib/workflow/permissions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <>
      <PageHeader eyebrow="Settings" title="Account and organisation" />
      <dl className="grid max-w-xl grid-cols-[10rem_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{session.displayName}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{session.email}</dd>
        <dt className="text-muted-foreground">Organisation</dt>
        <dd>{session.orgName}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{roleLabel(session.role, session.specialistKind)}</dd>
      </dl>
      <h2 className="font-heading mt-10 mb-3 text-xl">Transparency</h2>
      <p className="text-sm">
        <Link href="/settings/ai-use" className="font-medium underline underline-offset-4">
          Services and AI use
        </Link>{" "}
        lists every external service, what data it receives, and the models in use.
      </p>
    </>
  );
}
