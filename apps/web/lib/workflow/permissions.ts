import type { Database } from "@/types/database";

/**
 * SPEC §2 permission matrix, for UI gating only. RLS and transition_content() enforce it.
 *
 * `full` = ●, `limited` = ◐ or a footnoted ● (scoped: e.g. a specialist only on content routed
 * to their kind), `none` = ○.
 */

export type Role = Database["public"]["Enums"]["member_role"];
export type SpecialistKind = Database["public"]["Enums"]["specialist_kind"];
export type Access = "full" | "limited" | "none";

export const ROLES = [
  "agency_creator",
  "creator",
  "manager",
  "specialist",
  "brand_admin",
] as const satisfies readonly Role[];

export const ACTIONS = [
  "define_vault",
  "submit_content",
  "see_full_finding",
  "resolve_finding",
  "comment",
  "approve_or_request_changes",
  "sign_off",
  "view_insights",
  "view_audit_log",
] as const;
export type Action = (typeof ACTIONS)[number];

type Row = Record<Role, Access>;
const row = (
  agency_creator: Access,
  creator: Access,
  manager: Access,
  specialist: Access,
  brand_admin: Access,
): Row => ({ agency_creator, creator, manager, specialist, brand_admin });

//                                         Agency     Creator    Manager    Specialist Admin
export const MATRIX: Record<Action, Row> = {
  define_vault: /*                  */ row("none", "none", "none", "none", "full"),
  submit_content: /*                */ row("full", "full", "full", "none", "full"),
  see_full_finding: /*              */ row("limited", "full", "full", "full", "full"), // ¹ summary only
  resolve_finding: /*               */ row("full", "full", "limited", "limited", "full"), // ² while reviewing
  comment: /*                       */ row("full", "full", "full", "full", "full"),
  approve_or_request_changes: /*    */ row("none", "none", "full", "limited", "full"), // ³ routed kind
  sign_off: /*                      */ row("none", "none", "none", "limited", "limited"), // ³ ⁴ admin: a11y only
  view_insights: /*                 */ row("none", "none", "limited", "none", "full"), // ⁵ team-level only
  view_audit_log: /*                */ row("none", "none", "full", "full", "full"),
};

export function access(role: Role, action: Action): Access {
  return MATRIX[action][role];
}

/** True when the role may perform the action at all (fully or in a scoped way). */
export function can(role: Role, action: Action): boolean {
  return access(role, action) !== "none";
}

export const ROLE_LABELS: Record<Role, string> = {
  agency_creator: "Agency",
  creator: "Creator",
  manager: "Manager",
  specialist: "Specialist",
  brand_admin: "Brand admin",
};

export function roleLabel(role: Role, kind?: SpecialistKind | null): string {
  if (role === "specialist" && kind) return kind === "legal" ? "Legal" : "Accessibility";
  return ROLE_LABELS[role];
}

export type NavItem = { href: string; label: string };

/** Left-nav items for a role (P02). */
export function navFor(role: Role): NavItem[] {
  const items: NavItem[] = [];
  if (can(role, "submit_content")) items.push({ href: "/drafts", label: "Drafts" });
  if (can(role, "approve_or_request_changes"))
    items.push({ href: "/review", label: "Review queue" });
  if (can(role, "define_vault")) items.push({ href: "/vault", label: "Vault" });
  if (can(role, "view_insights")) items.push({ href: "/insights", label: "Insights" });
  items.push({ href: "/settings", label: "Settings" });
  return items;
}

/** Where a role lands after sign-in. */
export function homeFor(role: Role): string {
  return navFor(role)[0].href;
}
