import type { DemoUserKey } from "@/lib/auth/demo-users";

/** One line per demo role on what it can do (SPEC §2), for the login panel and switcher. */
export const DEMO_ROLE_BLURB: Record<DemoUserKey, string> = {
  admin: "Owns the rules and insights.",
  creator: "Writes and fixes drafts.",
  agency: "Submits drafts; sees rule summaries.",
  manager: "Approves or sends back.",
  legal: "Signs off claims.",
  a11y: "Signs off accessibility.",
};
