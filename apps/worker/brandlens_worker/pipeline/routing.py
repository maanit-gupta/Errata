"""Routing and risk score (SPEC §10). Weights live in config.py."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from brandlens_worker.config import RISK_WEIGHTS


@dataclass(frozen=True)
class RoutingFinding:
    dimension: str
    severity: str
    status: str = "open"


def route(findings: Iterable[RoutingFinding]) -> tuple[str, float]:
    fs = list(findings)
    w = RISK_WEIGHTS

    def is_open(f: RoutingFinding) -> bool:
        return f.status == "open"

    risk = (
        w["routed_blocker"] * sum(f.severity == "blocker" and f.status == "routed" for f in fs)
        + w["open_warning"] * sum(f.severity == "warning" and is_open(f) for f in fs)
        + w["open_suggestion"] * sum(f.severity == "suggestion" and is_open(f) for f in fs)
        + w["claims_not_dismissed"]
        * any(f.dimension == "claims" and f.status != "dismissed" for f in fs)
        + w["access_open"] * any(f.dimension == "access" and is_open(f) for f in fs)
    )
    if any(f.dimension == "claims" and f.status in ("routed", "open") for f in fs):
        to = "legal"
    elif any(
        f.dimension == "access" and f.severity in ("warning", "blocker") and is_open(f) for f in fs
    ):
        to = "a11y"
    elif any(f.dimension == "visual" and f.severity == "warning" and is_open(f) for f in fs):
        to = "brand"
    else:
        to = "manager"
    return to, float(risk)


def has_open_blockers(findings: Iterable[RoutingFinding]) -> bool:
    return any(f.severity == "blocker" and f.status == "open" for f in findings)
