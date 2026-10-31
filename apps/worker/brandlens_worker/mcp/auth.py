"""MCP key identity, the agency scrubber and the per-key rate limiter.

A `bl_mcp_` key resolves (by SHA-256 hash, `resolve_mcp_key`) to one user in one org with that
user's CURRENT membership role. Agency creators get the same rule view the app gives them
(`rule_cards_public`): code, dimension, title, summary, severity. No body, examples or source page.
"""

from __future__ import annotations

import hashlib
import time
from collections import deque
from dataclasses import dataclass
from typing import Any

from brandlens_worker import config

KEY_PREFIX = "bl_mcp_"


@dataclass(frozen=True)
class McpAuth:
    key_id: str
    org_id: str
    user_id: str
    role: str  # agency_creator | creator | manager | specialist | brand_admin

    @property
    def is_agency(self) -> bool:
        return self.role == "agency_creator"


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def scrub_rule_for_role(rule: dict[str, Any], auth: McpAuth) -> dict[str, Any]:
    """One rule card as the caller may see it. Never includes never_send cards (filtered in SQL)."""
    out: dict[str, Any] = {
        "code": rule["code"],
        "dimension": rule["dimension"],
        "severity": rule["severity"],
        "title": rule["title"],
        "summary": rule["summary"],
    }
    if not auth.is_agency:
        out["rule"] = rule["body"]
        out["examples"] = [
            {"kind": e.get("kind"), "text": e.get("text")}
            for e in (rule.get("examples") or [])
            if isinstance(e, dict) and e.get("text")
        ]
        out["source_page"] = rule.get("source_page")
    return out


class RateLimiter:
    """Sliding one-minute window per key. Only resolved keys (or client addresses for failed auth)
    get a bucket, and idle buckets are dropped, so memory stays bounded."""

    def __init__(self, per_minute: int = config.MCP_RATE_PER_MINUTE) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float | None = None, *, consume: bool = True) -> bool:
        """True if `key` is under its limit. `consume=False` checks without recording a hit."""
        t = time.monotonic() if now is None else now
        q = self._hits.setdefault(key, deque())
        while q and q[0] <= t - 60:
            q.popleft()
        if len(q) >= self.per_minute:
            return False
        if consume:
            q.append(t)
        self._prune(t)
        return True

    def _prune(self, t: float) -> None:
        if len(self._hits) < 256:
            return
        for k in [k for k, q in self._hits.items() if not q or q[-1] <= t - 60]:
            del self._hits[k]
