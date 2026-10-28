import Link from "next/link";
import { ShieldSpot } from "@/components/illustrations";

/** Forbidden state (DESIGN.md §11): never a blank page. */
export function Forbidden({
  role,
  action,
  backHref = "/drafts",
}: {
  role: string;
  action: string;
  backHref?: string;
}) {
  return (
    <section className="bg-band-grey flex flex-col items-center gap-3 rounded-lg px-6 py-12 text-center">
      <ShieldSpot className="w-28" />
      <h2 className="text-xl font-bold">You don&apos;t have access to this.</h2>
      <p className="text-fg-muted text-[0.9375rem]">
        {role} can&apos;t {action}. Ask a brand admin if that&apos;s wrong.
      </p>
      <Link href={backHref} className="text-fg text-sm font-semibold underline underline-offset-4">
        Back
      </Link>
    </section>
  );
}
