// P15 input limits. Uploads go through server actions, and a Vercel function request body is
// capped at 4.5 MB, so files stay under 4 MB (next.config.ts raises the action limit to match).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

// Signed Storage URLs (drafts, renders, assets, guides) are minted per server render; 15 minutes
// covers a review session (Realtime refreshes re-mint them) without leaving long-lived links.
export const SIGNED_URL_TTL_S = 900;
