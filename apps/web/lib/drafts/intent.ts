import { z } from "zod";

/** Submission intent (SPEC §5). Mirrors the worker's expectations; all but `notes` required. */
export const intentSchema = z.object({
  goal: z.string().trim().min(1, "Say what this content is for."),
  audience: z.string().trim().min(1, "Say who it's for."),
  cta: z.string().trim().min(1, "Add the call to action."),
  channel: z.string().trim().min(1, "Pick a channel."),
  campaign_id: z.uuid("Pick a campaign."),
  notes: z.string().trim().max(500).optional(),
  // Images only (P11): checked for presence (WCAG 1.1.1) and judged for quality by the vision pass.
  alt_text: z.string().trim().max(500).optional(),
});
export type Intent = z.infer<typeof intentSchema>;

export const CHANNELS = [
  { value: "instagram_caption", label: "Instagram caption" },
  { value: "linkedin_post", label: "LinkedIn post" },
  { value: "email", label: "Email" },
  { value: "push_notification", label: "Push notification" },
  { value: "web_page", label: "Web page" },
  { value: "webinar_deck", label: "Webinar deck" },
] as const;

export const DISMISS_REASONS = [
  { value: "approved_exception", label: "Approved exception" },
  { value: "doesnt_apply", label: "Rule doesn't apply here" },
  { value: "ai_wrong", label: "The check is wrong" },
] as const;
