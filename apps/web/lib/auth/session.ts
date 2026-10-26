import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Role, SpecialistKind } from "@/lib/workflow/permissions";

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  orgId: string;
  orgName: string;
  role: Role;
  specialistKind: SpecialistKind | null;
};

export type SessionResult =
  | { status: "signed_out" }
  | { status: "no_membership"; userId: string; email: string }
  | { status: "ok"; session: Session };

/** Data access layer: the signed-in user and their (first) org membership. Cached per request. */
export const getSession = cache(async (): Promise<SessionResult> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { status: "signed_out" };
  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("memberships")
      .select("org_id, role, specialist_kind, organisations(name)")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);

  if (!membership) return { status: "no_membership", userId, email };
  return {
    status: "ok",
    session: {
      userId,
      email,
      displayName: profile?.display_name ?? email,
      orgId: membership.org_id,
      orgName: membership.organisations?.name ?? "Organisation",
      role: membership.role,
      specialistKind: membership.specialist_kind,
    },
  };
});

/** For pages inside (app): redirects when signed out. */
export async function requireSession(): Promise<Session> {
  const result = await getSession();
  if (result.status === "signed_out") redirect("/login");
  if (result.status === "no_membership") redirect("/no-access");
  return result.session;
}
