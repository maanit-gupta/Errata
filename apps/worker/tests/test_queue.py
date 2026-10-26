import asyncio
from typing import Any

from brandlens_worker.queue import (
    JobContext,
    JobError,
    Message,
    Registry,
    consume,
    job_name,
    process_message,
)


class FakeBackend:
    def __init__(
        self, messages: list[Message] | None = None, statuses: dict[str, str] | None = None
    ) -> None:
        self.messages = list(messages or [])
        self.statuses = statuses or {}
        self.deleted: list[int] = []
        self.archived: list[int] = []
        self.failed: list[tuple[str, str]] = []
        self.read_calls = 0

    async def read(self, queue: str, vt: int, max_poll_seconds: int) -> Message | None:
        self.read_calls += 1
        if self.messages:
            return self.messages.pop(0)
        await asyncio.sleep(0)
        return None

    async def delete(self, queue: str, msg_id: int) -> None:
        self.deleted.append(msg_id)

    async def archive(self, queue: str, msg_id: int) -> None:
        self.archived.append(msg_id)

    async def run_status(self, run_id: str) -> str | None:
        return self.statuses.get(run_id)

    async def fail_run(self, run_id: str, error_code: str) -> None:
        self.failed.append((run_id, error_code))


def registry_with(**jobs: Any) -> Registry:
    r = Registry()
    for name, fn in jobs.items():
        r.add(name, fn)
    return r


def msg(payload: dict[str, Any], msg_id: int = 1, read_ct: int = 1) -> Message:
    return Message(msg_id=msg_id, read_ct=read_ct, payload=payload)


async def test_success_deletes_message() -> None:
    seen: list[JobContext] = []

    async def noop(ctx: JobContext) -> None:
        seen.append(ctx)

    backend = FakeBackend()
    outcome = await process_message(
        "review_jobs", msg({"type": "noop"}), backend=backend, registry=registry_with(noop=noop)
    )
    assert outcome == "done"
    assert backend.deleted == [1]
    assert backend.archived == []
    assert seen[0].queue == "review_jobs"


async def test_review_jobs_default_to_review_version() -> None:
    assert job_name("review_jobs", {"run_id": "r", "version_id": "v"}) == "review_version"
    assert job_name("vault_jobs", {"job": "embed_vault"}) == "embed_vault"
    assert job_name("vault_jobs", {}) is None


async def test_exception_fails_run_and_archives() -> None:
    async def boom(ctx: JobContext) -> None:
        raise RuntimeError("nope")

    backend = FakeBackend()
    outcome = await process_message(
        "review_jobs",
        msg({"type": "boom", "run_id": "run-1"}),
        backend=backend,
        registry=registry_with(boom=boom),
    )
    assert outcome == "failed"
    assert backend.failed == [("run-1", "crash:RuntimeError")]
    assert backend.archived == [1]
    assert backend.deleted == []


async def test_job_error_code_is_recorded() -> None:
    async def bad(ctx: JobContext) -> None:
        raise JobError("parse_failed")

    backend = FakeBackend()
    await process_message(
        "review_jobs",
        msg({"type": "bad", "run_id": "r"}),
        backend=backend,
        registry=registry_with(bad=bad),
    )
    assert backend.failed == [("r", "parse_failed")]


async def test_unknown_job_is_archived() -> None:
    backend = FakeBackend()
    outcome = await process_message(
        "vault_jobs", msg({"job": "mystery"}), backend=backend, registry=Registry()
    )
    assert outcome == "unknown_job"
    assert backend.archived == [1]


async def test_done_run_is_skipped_idempotently() -> None:
    calls = 0

    async def review(ctx: JobContext) -> None:
        nonlocal calls
        calls += 1

    backend = FakeBackend(statuses={"r1": "done"})
    outcome = await process_message(
        "review_jobs",
        msg({"run_id": "r1"}),
        backend=backend,
        registry=registry_with(review_version=review),
    )
    assert outcome == "skipped"
    assert calls == 0
    assert backend.deleted == [1]


async def test_poison_message_archived_after_max_reads() -> None:
    async def noop(ctx: JobContext) -> None:
        raise AssertionError("must not run")

    backend = FakeBackend()
    outcome = await process_message(
        "review_jobs",
        msg({"type": "noop", "run_id": "r"}, read_ct=4),
        backend=backend,
        registry=registry_with(noop=noop),
    )
    assert outcome == "poison"
    assert backend.failed == [("r", "max_reads_exceeded")]
    assert backend.archived == [1]


async def test_consume_loop_processes_then_stops() -> None:
    stop = asyncio.Event()
    done: list[int] = []

    async def noop(ctx: JobContext) -> None:
        done.append(ctx.message.msg_id)
        if len(done) == 2:
            stop.set()

    backend = FakeBackend([msg({"type": "noop"}, 1), msg({"type": "noop"}, 2)])
    await asyncio.wait_for(
        consume("review_jobs", backend=backend, registry=registry_with(noop=noop), stop=stop),
        timeout=2,
    )
    assert done == [1, 2]
    assert backend.deleted == [1, 2]


async def test_consume_survives_read_errors() -> None:
    stop = asyncio.Event()

    class Flaky(FakeBackend):
        async def read(self, queue: str, vt: int, max_poll_seconds: int) -> Message | None:
            self.read_calls += 1
            if self.read_calls == 1:
                raise ConnectionError("db down")
            stop.set()
            return None

    backend = Flaky()
    task = asyncio.create_task(
        consume("review_jobs", backend=backend, registry=Registry(), stop=stop)
    )
    await asyncio.wait_for(task, timeout=5)
    assert backend.read_calls == 2
