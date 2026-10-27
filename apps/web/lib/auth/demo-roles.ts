import type { DemoUserKey } from "@/lib/auth/demo-users";

/** One line per demo role on what it can do (SPEC §2), for the login panel and switcher. */
export const DEMO_ROLE_BLURB: Record<DemoUserKey, string> = {
  admin: "Defines the vault, approves rule cards, sees insights.",
  creator: "Writes drafts, resolves findings, submits for review.",
  agency: "Submits drafts, sees rule summaries only.",
  manager: "Approves or requests changes; team insights.",
  legal: "Signs off claims routed to Legal.",
  a11y: "Signs off accessibility findings.",
};
