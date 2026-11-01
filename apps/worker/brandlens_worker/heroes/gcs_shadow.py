"""GCS shadow sandbox (Round 3 extra, Hero 5): before approving clarified examples for a rule,
backtest them on the rule's recent findings, locally and deterministically.

What it does, and what it doesn't:
- **Current GCS** is the dashboard's own number: SQL `rule_gcs()` (same window, same definitions,
  same real-data filter). Nothing here re-implements the score.
- The **projection** only re-scores the dismissal component. Each of the last
  `SHADOW_SAMPLE` findings is embedded with the worker's local bge-small model and compared with
  two anchors: the clarified rule (body + "don't" examples) and its "do" examples. A finding whose
  quote sits closer to the "do" anchor is projected to stop triggering. Dismissed-as-"doesn't
  apply" findings that stop triggering are false positives removed; any other finding that stops
  triggering is a **true positive the clarified rule would miss**, reported, never hidden.
- Override and low-confidence rates are **held at their current values**: no model can say how
  reviewers would have decided. The spec's fixed "× 0.4" factor and hardcoded fallback numbers
  are not used.
- Fewer than `config.GCS_MIN_N` findings in the sample: "insufficient data", no numbers.
- Same inputs, same output: no randomness, no LLM, no network.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass
from typing import Any

import numpy as np

from brandlens_worker import config

SHADOW_SAMPLE = 30  # most recent findings backtested
PROJECTION_NOTE = (
    "Projection, not a measurement: the dismissal rate is re-scored on the last findings with "
    "local embeddings; override and low-confidence rates are held at their current values."
)

Embed = Callable[[Sequence[str]], Any]


def gcs(dismissal: float, override: float, low_conf: float) -> int:
    """Same formula and rounding as SQL `rule_gcs`: round() on double precision, which in Postgres
    is half-to-even, like Python's round()."""
    return round(100 * (1 - (0.45 * dismissal + 0.35 * override + 0.20 * low_conf)))


def status(score: int | None, n: int) -> str:
    if score is None or n < config.GCS_MIN_N:
        return "insufficient"
    if score < config.GCS_UNCLEAR:
        return "unclear"
    return "watch" if score <= config.GCS_WATCH_MAX else "clear"


@dataclass(frozen=True)
class SampleFinding:
    id: str
    quote: str
    dismissed_doesnt_apply: bool


@dataclass(frozen=True)
class ShadowResult:
    rule_code: str
    status: str  # "projection" | "insufficient_data"
    sample_size: int
    current_gcs: int | None
    current_status: str
    dismissal_rate_now: float | None
    override_rate: float | None
    low_confidence_rate: float | None
    sample_dismissal_rate: float | None
    projected_dismissal_rate: float | None
    projected_gcs: int | None
    projected_status: str | None
    false_positives_removed: int
    true_positives_lost: int
    note: str

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


def _anchor(embed: Embed, texts: list[str]) -> np.ndarray:
    vecs = np.asarray(embed(texts), dtype=np.float64)
    v = vecs.mean(axis=0)
    n = np.linalg.norm(v)
    return v / n if n else v


def project(
    *,
    rule_code: str,
    current: dict[str, Any] | None,
    sample: list[SampleFinding],
    rule_body: str,
    do_examples: list[str],
    dont_examples: list[str],
    embed: Embed,
) -> ShadowResult:
    """`current` is the rule's `rule_gcs()` row (n, dismissal_rate, override_rate,
    low_confidence_rate, gcs), or None if it has no findings in the window."""
    n_now = int(current["n"]) if current else 0
    base: dict[str, Any] = {
        "rule_code": rule_code,
        "sample_size": len(sample),
        "current_gcs": current.get("gcs") if current else None,
        "current_status": status(current.get("gcs") if current else None, n_now),
        "dismissal_rate_now": _r(current.get("dismissal_rate")) if current else None,
        "override_rate": _r(current.get("override_rate")) if current else None,
        "low_confidence_rate": _r(current.get("low_confidence_rate")) if current else None,
    }
    if len(sample) < config.GCS_MIN_N or not current or not do_examples:
        return ShadowResult(
            **base,
            status="insufficient_data",
            sample_dismissal_rate=None,
            projected_dismissal_rate=None,
            projected_gcs=None,
            projected_status=None,
            false_positives_removed=0,
            true_positives_lost=0,
            note=f"Needs at least {config.GCS_MIN_N} findings and at least one 'do' example.",
        )
    violation = _anchor(embed, [" ".join([rule_body, *dont_examples]).strip() or rule_body])
    safe = _anchor(embed, do_examples)
    quotes = np.asarray(embed([f.quote or " " for f in sample]), dtype=np.float64)
    norms = np.linalg.norm(quotes, axis=1, keepdims=True)
    norms[norms == 0] = 1
    quotes = quotes / norms
    still = (quotes @ violation) - (quotes @ safe) >= 0  # closer to the rule than to "do"

    dismissed = sum(f.dismissed_doesnt_apply for f in sample)
    fp_removed = sum(
        1 for f, s in zip(sample, still, strict=True) if f.dismissed_doesnt_apply and not s
    )
    tp_lost = sum(
        1 for f, s in zip(sample, still, strict=True) if not f.dismissed_doesnt_apply and not s
    )
    remaining = len(sample) - fp_removed - tp_lost
    d_sample = dismissed / len(sample)
    d_after = (dismissed - fp_removed) / remaining if remaining else 0.0
    o = float(current.get("override_rate") or 0.0)
    lc = float(current.get("low_confidence_rate") or 0.0)
    projected = gcs(d_after, o, lc)
    return ShadowResult(
        **base,
        status="projection",
        sample_dismissal_rate=_r(d_sample),
        projected_dismissal_rate=_r(d_after),
        projected_gcs=projected,
        projected_status=status(projected, remaining),
        false_positives_removed=fp_removed,
        true_positives_lost=tp_lost,
        note=PROJECTION_NOTE,
    )


def _r(x: Any) -> float | None:
    return None if x is None else round(float(x), 3)
