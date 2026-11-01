import type { ShadowResult } from "@/lib/insights/actions";
import type { VisualFix } from "@/lib/drafts/visual-fix";

/** Kitchen-sink samples for Hero 3: sample 01 and 17 from apps/worker/tests/fixtures/autoheal_samples.json. */
export const VISUAL_FIX_NORMAL: VisualFix = {
  original_text_hex: "#888888",
  original_bg_hex: "#FFFFFF",
  original_ratio: 3.54,
  healed_text_hex: "#B5562F",
  healed_text_name: "Terracotta",
  healed_bg_hex: "#FFFFFF",
  healed_bg_name: null,
  healed_ratio: 4.84,
  required_ratio: 4.5,
  strategy: "text",
  source: "palette",
};

export const VISUAL_FIX_LARGE: VisualFix = {
  original_text_hex: "#D63A24",
  original_bg_hex: "#B5562F",
  original_ratio: 1.04,
  healed_text_hex: "#141414",
  healed_text_name: "Ink",
  healed_bg_hex: "#B5562F",
  healed_bg_name: null,
  healed_ratio: 3.8,
  required_ratio: 3,
  strategy: "text",
  source: "palette",
};

/** Hero 2 samples: an active receipt and a revoked one. */
export const MANIFEST_ACTIVE = {
  hash: "5d2a9c0f1e7b3a4c8d6e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c",
  hashOf: "normalised body",
  facts: [
    { code: "E-19", valid_until: "2026-11-15T18:29:59Z" },
    { code: "F-048", valid_until: null },
  ],
  validUntil: "2026-11-15T18:29:59Z",
  issuedAt: "2026-11-01T06:00:00Z",
  revokedAt: null,
  revokedReason: null,
};

export const MANIFEST_REVOKED = {
  ...MANIFEST_ACTIVE,
  revokedAt: "2026-11-02T06:00:00Z",
  revokedReason:
    "Fact E-19 changed after approval (Diwali Wealth Webinar: online only, Oct 29, 7:00 PM IST). Re-check the copy against the vault.",
};

/** Hero 5 samples (dev preview only, not measurements). */
export const SHADOW_PROJECTION: ShadowResult = {
  rule_code: "TV-04",
  status: "projection",
  sample_size: 30,
  current_gcs: 60,
  current_status: "unclear",
  dismissal_rate_now: 0.49,
  override_rate: 0.36,
  low_confidence_rate: 0.27,
  sample_dismissal_rate: 0.5,
  projected_dismissal_rate: 0.2,
  projected_gcs: 74,
  projected_status: "watch",
  false_positives_removed: 9,
  true_positives_lost: 1,
  note: "Projection, not a measurement: the dismissal rate is re-scored on the last findings with local embeddings; override and low-confidence rates are held at their current values.",
  elapsed_ms: 120,
};

export const SHADOW_INSUFFICIENT: ShadowResult = {
  ...SHADOW_PROJECTION,
  status: "insufficient_data",
  sample_size: 4,
  projected_gcs: null,
  projected_status: null,
  sample_dismissal_rate: null,
  projected_dismissal_rate: null,
  false_positives_removed: 0,
  true_positives_lost: 0,
  note: "Needs at least 10 findings and at least one 'do' example.",
};
