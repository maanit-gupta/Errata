"""Langfuse Cloud tracing. Best-effort: if Langfuse is unreachable or misconfigured, every helper
no-ops and the review continues. Inputs are recorded as metadata (ids, counts, versions) only;
never pass raw draft text here (CLAUDE.md invariant 5)."""

from __future__ import annotations

import contextlib
import logging
from collections.abc import Iterator
from typing import Any

log = logging.getLogger(__name__)


class _NoopObservation:
    def update(self, **_: Any) -> None:
        return None


class Tracer:
    def __init__(self, client: Any | None) -> None:
        self._client = client

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @classmethod
    def from_settings(cls, settings: Any, *, enabled: bool = True) -> Tracer:
        if not enabled:
            return cls(None)
        try:
            from langfuse import Langfuse

            client = Langfuse(
                public_key=settings.langfuse_public_key.get_secret_value(),
                secret_key=settings.langfuse_secret_key.get_secret_value(),
                base_url=settings.langfuse_host,
                environment=_env_name(settings.env),
            )
        except Exception:
            log.warning("langfuse unavailable; tracing disabled", exc_info=True)
            return cls(None)
        return cls(client)

    @contextlib.contextmanager
    def trace_run(self, run_id: str, *, name: str = "review_run", **metadata: Any) -> Iterator[Any]:
        """Root span for one job. Yields the span (or a no-op stand-in)."""
        if self._client is None:
            yield _NoopObservation()
            return
        try:
            cm = self._client.start_as_current_observation(
                name=name, as_type="span", metadata={"run_id": run_id, **metadata}
            )
            span = cm.__enter__()
        except Exception:
            log.warning("langfuse span failed; continuing untraced", exc_info=True)
            yield _NoopObservation()
            return
        try:
            yield span
        finally:
            with contextlib.suppress(Exception):
                cm.__exit__(None, None, None)

    def current_trace_id(self) -> str | None:
        if self._client is None:
            return None
        try:
            trace_id = self._client.get_current_trace_id()
        except Exception:
            return None
        return str(trace_id) if trace_id else None

    def generation(
        self,
        name: str,
        *,
        prompt_version: str,
        model: str,
        input_meta: dict[str, Any],
        output: Any,
        usage: dict[str, int] | None = None,
        latency_ms: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Record one LLM call. `input_meta` is ids/counts only; `output` is the validated JSON."""
        if self._client is None:
            return
        try:
            gen = self._client.start_observation(
                name=name,
                as_type="generation",
                model=model,
                input=input_meta,
                output=output,
                version=prompt_version,
                usage_details={k: v for k, v in (usage or {}).items() if v is not None},
                metadata={
                    "prompt_version": prompt_version,
                    "latency_ms": latency_ms,
                    **(metadata or {}),
                },
            )
            gen.end()
        except Exception:
            log.warning("langfuse generation failed; continuing", exc_info=True)

    def flush(self) -> None:
        if self._client is None:
            return
        with contextlib.suppress(Exception):
            self._client.flush()

    def shutdown(self) -> None:
        if self._client is None:
            return
        with contextlib.suppress(Exception):
            self._client.shutdown()


def _env_name(env: str) -> str:
    # Langfuse environments must be lowercase alnum/-/_ and can't start with "langfuse".
    cleaned = "".join(c for c in env.lower() if c.isalnum() or c in "-_")
    return cleaned or "default"
