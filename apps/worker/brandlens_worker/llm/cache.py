"""File-based LLM response cache for eval and tests (CLAUDE.md "Free-tier LLM etiquette").

Keyed by sha256(provider, model, prompt_version, payload). Active only when enabled, which
defaults to `config.LLM_CACHE` (False in production).
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from brandlens_worker import config

log = logging.getLogger(__name__)

DEFAULT_DIR = Path(__file__).resolve().parents[2] / "eval" / ".cache"


def cache_key(provider: str, model: str, prompt_version: str, payload: dict[str, Any]) -> str:
    blob = json.dumps([provider, model, prompt_version, payload], sort_keys=True, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()


class LLMCache:
    def __init__(self, directory: Path = DEFAULT_DIR, *, enabled: bool = config.LLM_CACHE) -> None:
        self.directory = directory
        self.enabled = enabled

    def _path(self, key: str) -> Path:
        return self.directory / f"{key}.json"

    def get(self, key: str) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        path = self._path(key)
        if not path.exists():
            return None
        try:
            value = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            log.warning("unreadable cache entry; ignoring", extra={"key": key})
            return None
        return value if isinstance(value, dict) else None

    def put(self, key: str, value: dict[str, Any]) -> None:
        if not self.enabled:
            return
        self.directory.mkdir(parents=True, exist_ok=True)
        tmp = self._path(key).with_suffix(".tmp")
        tmp.write_text(json.dumps(value, sort_keys=True, default=str))
        tmp.replace(self._path(key))
