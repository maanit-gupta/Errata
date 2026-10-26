import type { Role, SpecialistKind } from "@/lib/workflow/permissions";

/** Seeded demo users (SPEC §16, supabase/seed.sql). Emails only; the password stays server-side. */
export const DEMO_USERS = [
  { key: "admin", label: "Brand admin", email: "admin@paywise.demo", role: "brand_admin" },
  { key: "creator", label: "Creator", email: "creator@paywise.demo", role: "creator" },
  { key: "agency", label: "Agency", email: "agency@paywise.demo", role: "agency_creator" },
  { key: "manager", label: "Manager", email: "manager@paywise.demo", role: "manager" },
  { key: "legal", label: "Legal", email: "legal@paywise.demo", role: "specialist", kind: "legal" },
  {
    key: "a11y",
    label: "Accessibility",
    email: "a11y@paywise.demo",
    role: "specialist",
    kind: "a11y",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  email: string;
  role: Role;
  kind?: SpecialistKind;
}[];

export type DemoUserKey = (typeof DEMO_USERS)[number]["key"];

export function isDemoUserKey(value: unknown): value is DemoUserKey {
  return DEMO_USERS.some((u) => u.key === value);
}
