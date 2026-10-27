import Link from "next/link";
import { PixelGlyph } from "@/components/brand/pixel-glyphs";

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
    <section className="border-line bg-elevated flex flex-col items-center gap-3 rounded-md border px-6 py-14 text-center">
      <PixelGlyph name="lock" size={48} />
      <h2 className="text-xl">You don&apos;t have access to this.</h2>
      <p className="text-fg-muted text-sm">
        {role} can&apos;t {action}. Ask a brand admin if you think that&apos;s wrong.
      </p>
      <Link href={backHref} className="text-accent-soft text-sm underline-offset-4 hover:underline">
        ← Back
      </Link>
    </section>
  );
}
