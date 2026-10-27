import { Forbidden } from "@/components/brand/forbidden";

/** Forbidden state for a page (DESIGN.md §11). */
export function NoAccess({ what, role = "Your role" }: { what: string; role?: string }) {
  return <Forbidden role={role} action={`view ${what}`} />;
}
