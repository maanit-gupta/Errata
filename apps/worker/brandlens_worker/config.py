"""Tunable thresholds (SPEC §14). Versioned in git and visible to the eval gate.

Changing any value requires a note in PROGRESS.md Decisions plus a fresh `make eval`.
"""

from typing import Final, Literal

Severity = Literal["blocker", "warning", "suggestion"]
Dimension = Literal["tone", "terms", "facts", "claims", "visual", "access"]

INTENT_COSINE: Final = 0.82
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
LOGO_MIN_GOOD_MATCHES: Final = 12  # tuned in P11 on fixtures
CLEAR_SPACE_VARIANCE_MAX: Final[float | None] = None  # tuned in P11
DELTA_E_MAX_DEFAULT: Final = 10
LLM_CACHE: Final = False  # True in eval/tests
