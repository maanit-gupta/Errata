"""Tunable thresholds (SPEC §14). Versioned in git and visible to the eval gate.

Changing any value requires a note in PROGRESS.md Decisions plus a fresh `make eval`.
"""

from typing import Final, Literal

Severity = Literal["blocker", "warning", "suggestion"]
Dimension = Literal["tone", "terms", "facts", "claims", "visual", "access"]

INTENT_COSINE: Final = 0.74  # P14 calibration (eval/report.md): 0.82 dropped 6 of 16 good rewrites
HUMAN_CONFIDENCE: Final = 0.6
TOPK: Final = 8
MAX_WORDS: Final = 2000
PDF_MAX_PAGES: Final = 40
P95_TARGET_S: Final = 15
GCS_UNCLEAR: Final = 65
GCS_WATCH_MAX: Final = 75
GCS_MIN_N: Final = 10
PRECISION_GATE: Final = 0.85
RECALL_TARGET: Final = 0.80

# Updated from the eval report; dimensions under PRECISION_GATE ship as "suggestion".
DIMENSION_MAX_SEVERITY: Final[dict[Dimension, Severity]] = {
    "tone": "warning",
    "terms": "blocker",
    "facts": "blocker",
    "claims": "blocker",
    "visual": "warning",
    "access": "warning",
}

# SPEC §10. Mirrored as display-only constants in the web app.
RISK_WEIGHTS: Final[dict[str, int]] = {
    "routed_blocker": 5,
    "open_warning": 3,
    "open_suggestion": 1,
    "claims_not_dismissed": 4,
    "access_open": 2,
}

READING_GRADE_TARGET: Final = 9
EXCLAMATION_PER_WORDS: Final = 40
CAPS_RATIO_MAX: Final = 0.15
# Vision (P11), tuned on fixtures/paywise/creatives; numbers in apps/worker/eval/vision_report.md.
LOGO_MIN_GOOD_MATCHES: Final = 12  # ORB RANSAC inliers (fixtures: 58-216 when present)
CLEAR_SPACE_VARIANCE_MAX: Final = (
    150.0  # grey variance in the clear-space ring (clean 0, cramped 7311)
)
DELTA_E_MAX_DEFAULT: Final = 10  # when the palette asset doesn't set max_delta_e
LOGO_MIN_WIDTH_DEFAULT: Final = 80  # px, when the logo asset doesn't set min_width_px
CLEAR_SPACE_RATIO_DEFAULT: Final = 0.25  # × logo height, when the asset doesn't set it
LARGE_TEXT_PX: Final = 24  # OCR word height at which WCAG "large text" (3:1) applies
TINY_TEXT_PX: Final = 12  # text shorter than this is hidden fine print (A-02)
FAINT_TEXT_RATIO: Final = 1.5  # contrast below this is hidden (near-invisible) text
WARMTH_COOL_B: Final = -4.0  # mean CIELAB b* below this pre-filters an image as cold (VS-02)
VISION_MAX_SIDE: Final = 1024  # the LLM-bound copy of an image is downscaled to this
# PDFs (P12). Pages are rendered so the long side is at most PDF_RENDER_MAX_SIDE px; bboxes and
# thumbnails share that pixel space.
PDF_RENDER_MAX_SIDE: Final = 1400
PDF_RENDER_MAX_ZOOM: Final = 2.0
PDF_MAX_WORDS: Final = 12000  # a deck is bounded by PDF_MAX_PAGES; this caps text-dense PDFs
PDF_HIDDEN_PT: Final = 4.0  # text smaller than this (points) is hidden (SPEC §6 stage 2)
PDF_IMAGE_MIN_PX: Final = 120  # embedded images smaller than this (rendered px) aren't analysed
PDF_CHUNK_WORDS: Final = 700  # whole pages are packed into LLM chunks up to this many words
# Padded tokens per ONNX embedding batch (texts × longest); bounds peak memory on the 512 MB
# worker. 512 = one full-length text alone (P12 benchmark: 205 MB vs 498 MB for a batch of 16).
EMBED_TOKEN_BUDGET: Final = 512
LLM_CACHE: Final = False  # True in eval/tests

# Queues (SQL migration 20261026100011). Review jobs use PGMQ_QUEUE from env.
VAULT_QUEUE: Final = "vault_jobs"
# P15: concurrent review consumers. Text jobs are I/O-bound (LLM calls), so several overlap; image
# and PDF stages 1-4 (render, OCR, vision) share HEAVY_JOB_SLOTS so the 512 MB worker can't run two
# 40-page decks at once (P12 peak RSS 484 MB).
REVIEW_CONSUMERS: Final = 3
HEAVY_JOB_SLOTS: Final = 1
LLM_RATE_LIMIT_COOLDOWN_S: Final = 60  # skip a provider this long after it stays 429 (router.py)
DB_POOL_MAX: Final = 8  # REVIEW_CONSUMERS + 1 vault long-polls, plus per-job queries

# R3: read-only MCP server (mcp.py).
MCP_RATE_PER_MINUTE: Final = 60  # calls per token per minute (in-process; one worker instance)
MCP_MAX_RESULTS: Final = 10  # search_brand_rules limit cap
MCP_MAX_QUERY_CHARS: Final = 500
MCP_MAX_BODY_BYTES: Final = 32_768
MCP_AUTH_FAILURES_PER_MINUTE: Final = 30  # bad/missing tokens per client address
