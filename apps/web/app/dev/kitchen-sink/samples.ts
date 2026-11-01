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
