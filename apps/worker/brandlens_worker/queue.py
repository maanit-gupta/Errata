"""pgmq consumer loop: read → dispatch to a registered job → delete, or fail the run and archive.

The web never touches pgmq; it calls `enqueue_review()` / `enqueue_vault_job()` in SQL. The worker
uses pgmq's SQL API directly over the session pooler.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from brandlens_worker import db

log = logging.getLogger(__name__)

# A message that keeps crashing the worker (so it's never deleted or archived) is retried after
# the visibility timeout; after this many reads it's archived as poison.
MAX_READS = 3

DEFAULT_JOB_FOR_QUEUE = {"review_jobs": "review_version"}


class JobError(Exception):
    """A job failed in a known way. `code` is stored on `review_runs.error_code`."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class Message:
    msg_id: int
    read_ct: int
    payload: dict[str, Any]


@dataclass
class JobContext:
    queue: str
    message: Message
    pool: Any  # AsyncConnectionPool; Any keeps fakes simple in tests
    services: dict[str, Any] = field(default_factory=dict)


Job = Callable[[JobContext], Awaitable[None]]


class Registry:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def register(self, name: str) -> Callable[[Job], Job]:
        def deco(fn: Job) -> Job:
            self._jobs[name] = fn
            return fn

        return deco

    def add(self, name: str, fn: Job) -> None:
        self._jobs[name] = fn

    def get(self, name: str) -> Job | None:
        return self._jobs.get(name)

    def names(self) -> list[str]:
        return sorted(self._jobs)


class QueueBackend(Protocol):
    """pgmq operations; `PgmqBackend` in production, a fake in tests."""

    async def read(self, queue: str, vt: int, max_poll_seconds: int) -> Message | None: ...
    async def delete(self, queue: str, msg_id: int) -> None: ...
    async def archive(self, queue: str, msg_id: int) -> None: ...
    async def run_status(self, run_id: str) -> str | None: ...
    async def fail_run(self, run_id: str, error_code: str) -> None: ...


class PgmqBackend:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def read(self, queue: str, vt: int, max_poll_seconds: int) -> Message | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select msg_id, read_ct, message from pgmq.read_with_poll(%s, %s, 1, %s)",
                (queue, vt, max_poll_seconds),
            )
            row = await cur.fetchone()
        if row is None:
            return None
        payload = row["message"] if isinstance(row["message"], dict) else {}
        return Message(msg_id=int(row["msg_id"]), read_ct=int(row["read_ct"]), payload=payload)

    async def delete(self, queue: str, msg_id: int) -> None:
        async with self.pool.connection() as conn:
            await conn.execute("select pgmq.delete(%s, %s::bigint)", (queue, msg_id))

    async def archive(self, queue: str, msg_id: int) -> None:
        async with self.pool.connection() as conn:
            await conn.execute("select pgmq.archive(%s, %s::bigint)", (queue, msg_id))

    async def run_status(self, run_id: str) -> str | None:
        async with self.pool.connection() as conn:
            return await db.get_run_status(conn, run_id)

    async def fail_run(self, run_id: str, error_code: str) -> None:
        async with self.pool.connection() as conn:
            await db.fail_run(conn, run_id, error_code)


def job_name(queue: str, payload: dict[str, Any]) -> str | None:
    name = payload.get("type") or payload.get("job") or DEFAULT_JOB_FOR_QUEUE.get(queue)
    return str(name) if name else None


async def process_message(
    queue: str,
    msg: Message,
    *,
    backend: QueueBackend,
    registry: Registry,
    pool: Any = None,
    services: dict[str, Any] | None = None,
) -> str:
    """Handle one message. Returns the outcome (for logs and tests). Never raises."""
    name = job_name(queue, msg.payload)
    run_id = msg.payload.get("run_id")
    base = {"queue": queue, "msg_id": msg.msg_id, "job": name, "run_id": run_id}
    started = time.perf_counter()

    async def fail(code: str) -> None:
        if run_id:
            try:
                await backend.fail_run(str(run_id), code)
            except Exception:
                log.exception("could not mark run failed", extra=base)
        await backend.archive(queue, msg.msg_id)

    try:
        job = registry.get(name) if name else None
        if job is None:
            log.error("unknown job; archiving", extra=base)
            await fail("unknown_job")
            return "unknown_job"

        if msg.read_ct > MAX_READS:
            log.error(
                "message exceeded max reads; archiving", extra={**base, "read_ct": msg.read_ct}
            )
            await fail("max_reads_exceeded")
            return "poison"

        if run_id and await backend.run_status(str(run_id)) == "done":
            log.info("run already done; skipping", extra=base)
            await backend.delete(queue, msg.msg_id)
            return "skipped"

        await job(JobContext(queue=queue, message=msg, pool=pool, services=services or {}))
        await backend.delete(queue, msg.msg_id)
        log.info("job done", extra={**base, "ms": round((time.perf_counter() - started) * 1000)})
        return "done"
    except JobError as exc:
        log.warning("job failed", extra={**base, "error_code": exc.code})
        await fail(exc.code)
        return "failed"
    except Exception as exc:
        log.exception("job crashed", extra={**base, "error": type(exc).__name__})
        try:
            await fail(f"crash:{type(exc).__name__}")
        except Exception:
            log.exception("could not archive message", extra=base)
        return "failed"


async def consume(
    queue: str,
    *,
    backend: QueueBackend,
    registry: Registry,
    stop: asyncio.Event,
    pool: Any = None,
    services: dict[str, Any] | None = None,
    vt: int = 120,
    max_poll_seconds: int = 5,
) -> None:
    """Long-poll `queue` until `stop` is set. Survives DB hiccups with a short backoff."""
    log.info("consumer started", extra={"queue": queue, "jobs": registry.names()})
    backoff = 1.0
    while not stop.is_set():
        try:
            msg = await backend.read(queue, vt, max_poll_seconds)
            backoff = 1.0
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("queue read failed; backing off", extra={"queue": queue, "s": backoff})
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=backoff)
            backoff = min(backoff * 2, 30.0)
            continue
        if msg is None:
            continue
        await process_message(
            queue, msg, backend=backend, registry=registry, pool=pool, services=services
        )
    log.info("consumer stopped", extra={"queue": queue})
