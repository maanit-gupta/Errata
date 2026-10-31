"""Load test (P15, extended in Round 3): N concurrent ~500-word submissions through enqueue_review(),
then wait for every run and report P50/P95, failures, lost jobs and the "AI check pending" path.

LOCAL STACK ONLY: it refuses a non-local DATABASE_URL (no live load test without the owner's
go-ahead). It submits as the demo creator straight to Postgres, the same path the web server action
takes after saving a version. The 10-per-minute submit limit would refuse most of a burst from one
user, so the creator gets a one-minute allowance for the burst, removed afterwards (the limiter is
covered by supabase/tests/06_rate_limit.test.sql).

Worker modes:
  (default)               In-process consumers: the worker's own `consume()` loop, job registry and
                          pgmq backend, with config.REVIEW_CONSUMERS consumers like the real worker,
                          and a fake LLM that answers instantly. Spends no LLM quota. Stop
                          `make dev-worker` first; the script refuses to run if another consumer is
                          polling the queue.
  --simulate-rate-limit   As above, but the fake LLM answers 429 for the first --rate-limit-window
                          seconds, then succeeds. Runs go "AI check pending" and must complete on
                          the real retry schedule (config.LLM_PENDING_RETRY_DELAYS_S).
  --external-worker       Don't start consumers; use the worker you're running (`make dev-worker`).
                          It calls the real LLM providers in apps/worker/.env: spends quota.

Usage (local Supabase up, `make db-reset` done):
  eval "$(scripts/local-supabase-env.sh)"
  cd apps/worker && uv run python ../../scripts/load_test.py                         # 20 runs
  cd apps/worker && uv run python ../../scripts/load_test.py --simulate-rate-limit \\
      --report eval/load_report.md --note "MacBook Air M2, local Supabase"
  cd apps/worker && uv run python ../../scripts/load_test.py --n 100                 # more

"Non-LLM path" latency = submit → the run's deterministic findings are saved: `pending_since` for
runs that went pending, otherwise `finished_at` minus the LLM stage time.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row

from brandlens_worker import config
from brandlens_worker.llm.base import Image, Meta, RateLimited, T

ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
CREATOR = "10000000-0000-4000-8000-000000000002"
TITLE = "[load test] "
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}
P95_TARGET_S = float(config.P95_TARGET_S)
INTENT = {
    "goal": "webinar sign-ups",
    "audience": "first-time investors",
    "cta": "Register now",
    "channel": "instagram_caption",
    "campaign_id": DIWALI,
}
PARA = (
    "Saving a little every month is one of the calmest ways to build wealth over time. A SIP lets "
    "you invest a fixed amount on a date you choose, and you can pause or stop whenever you need "
    "to. On PayWise you can see every charge before you start, and our team answers questions in "
    "plain language. "
)
# ~500 words with one blocker and one glossary issue, so every run exercises the filters.
BODY = PARA * 9 + "Download the Paywise app and lock in assured returns. Register now."


class SimulatedLLM:
    """Stands in for Groq/Gemini: 429 until `limited_until` (monotonic), then a valid empty review.
    No network, no quota. Its provider name is recorded on the run, so foreign runs are spotted."""

    name = "simulated"

    def __init__(self, limited_until: float) -> None:
        self.limited_until = limited_until
        self.calls = 0
        self.limited = 0

    def model_for(self, *, vision: bool) -> str:
        return "simulated-llm"

    async def generate_structured(
        self,
        system: str,
        user: str,
        schema: type[T],
        *,
        vision_images: list[Image] | None = None,
        temperature: float = 0.2,
    ) -> tuple[T, Meta]:
        self.calls += 1
        if time.monotonic() < self.limited_until:
            self.limited += 1
            raise RateLimited(self.name, "429 (simulated)")
        return schema.model_validate({}), Meta(
            provider=self.name, model="simulated-llm", latency_ms=0
        )


class HashEmbedder:
    """Sandbox only (--embedder hash): when the bge-small model can't be downloaded. Retrieval
    quality is meaningless with it; timings exclude real embedding cost."""

    def embed(self, texts: Any) -> Any:
        import hashlib

        import numpy as np

        out = np.zeros((len(texts), 384), dtype=np.float32)
        for i, t in enumerate(texts):
            for w in str(t).lower().split():
                out[i, int(hashlib.md5(w.encode()).hexdigest(), 16) % 384] += 1
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return out / norms


def is_local(dsn: str) -> bool:
    return (urlparse(dsn).hostname or "") in LOCAL_HOSTS


def submit(dsn: str, i: int) -> str:
    content_id = str(uuid.uuid4())
    with psycopg.connect(dsn, autocommit=True, row_factory=dict_row) as conn, conn.transaction():
        conn.execute("set local role authenticated")
        conn.execute(
            "select set_config('request.jwt.claims', %s, true)",
            (json.dumps({"sub": CREATOR, "role": "authenticated"}),),
        )
        conn.execute(
            "insert into public.contents (id, org_id, campaign_id, owner_id, title, channel) "
            "values (%s, %s, %s, %s, %s, 'instagram_caption')",
            (content_id, ORG, DIWALI, CREATOR, f"{TITLE}{i:03d}"),
        )
        conn.execute(
            "insert into public.versions (content_id, body, format, intent) "
            "values (%s, %s, 'text', %s)",
            (content_id, BODY, json.dumps(INTENT)),
        )
        row = conn.execute(
            "select public.enqueue_review(current_version_id) as run_id "
            "from public.contents where id = %s",
            (content_id,),
        ).fetchone()
    assert row is not None
    return str(row["run_id"])


def other_consumers(dsn: str) -> int:
    with psycopg.connect(dsn, autocommit=True) as conn:
        row = conn.execute(
            "select count(*) from pg_stat_activity where pid <> pg_backend_pid() "
            "and query ilike %s",
            ("%read_with_poll%",),
        ).fetchone()
    return int(row[0]) if row else 0


def fetch_runs(dsn: str, ids: list[str]) -> list[dict[str, Any]]:
    with psycopg.connect(dsn, autocommit=True, row_factory=dict_row) as conn:
        return conn.execute(
            "select r.id::text, r.status::text, r.degraded, r.error_code, r.timings, r.provider, "
            "r.llm_pending, r.llm_attempts, "
            "extract(epoch from r.created_at)::float as created, "
            "extract(epoch from r.finished_at)::float as finished, "
            "exists (select 1 from pgmq.q_review_jobs q where q.message->>'run_id' = r.id::text) "
            "as queued "
            "from public.review_runs r where r.id = any(%s::uuid[])",
            (ids,),
        ).fetchall()


def pct(values: list[float], p: int) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return round(values[0], 2)
    return round(statistics.quantiles(values, n=100, method="inclusive")[p - 1], 2)


def summarise(rows: list[dict[str, Any]], n: int, t0: float) -> dict[str, Any]:
    finished = [r for r in rows if r["status"] in ("done", "failed")]
    unfinished = [r for r in rows if r["status"] not in ("done", "failed")]
    went_pending = [
        r for r in rows if r["llm_attempts"] or (r["timings"] or {}).get("pending_since")
    ]
    non_llm: list[float] = []
    e2e: list[float] = []
    for r in rows:
        t = r["timings"] or {}
        if t.get("pending_since"):
            non_llm.append(t["pending_since"] / 1000 - r["created"])
        elif r["status"] == "done" and r["finished"]:
            non_llm.append(r["finished"] - r["created"] - (t.get("llm") or 0) / 1000)
        if r["status"] == "done" and r["finished"]:
            e2e.append(r["finished"] - r["created"])
    pending_ms = [
        r["timings"]["pending_ms"] / 1000 for r in rows if (r["timings"] or {}).get("pending_ms")
    ]
    lost = [r["id"] for r in unfinished if not r["queued"]]
    wall = (max(r["finished"] for r in finished) - t0) if finished else None
    return {
        "submissions": n,
        "words_per_draft": len(BODY.split()),
        "finished": len(finished),
        "failed": sum(r["status"] == "failed" for r in rows),
        "failure_codes": sorted({r["error_code"] for r in rows if r["status"] == "failed"}),
        "unfinished": len(unfinished),
        "lost_jobs": len(lost),
        "degraded": sum(bool(r["degraded"]) and r["status"] == "done" for r in rows),
        "went_pending": len(went_pending),
        "pending_completed": sum(r["status"] == "done" and not r["degraded"] for r in went_pending),
        "pending_degraded": sum(
            r["status"] == "done" and bool(r["degraded"]) for r in went_pending
        ),
        "pending_still_open": sum(r["status"] not in ("done", "failed") for r in went_pending),
        "foreign_runs": sum(
            1 for r in finished if r["provider"] not in (None, "simulated") and not r["degraded"]
        ),
        "non_llm_p50_s": pct(non_llm, 50),
        "non_llm_p95_s": pct(non_llm, 95),
        "non_llm_max_s": round(max(non_llm), 2) if non_llm else None,
        "e2e_p50_s": pct(e2e, 50),
        "e2e_p95_s": pct(e2e, 95),
        "pending_to_done_p50_s": pct(pending_ms, 50),
        "pending_to_done_max_s": round(max(pending_ms), 1) if pending_ms else None,
        "wall_s": round(wall, 1) if wall else None,
        "throughput_per_min": round(len(finished) / wall * 60, 1) if wall else None,
    }


def verdicts(s: dict[str, Any], simulate: bool) -> list[tuple[str, str, str, bool]]:
    out = [
        (f"Non-LLM path P95 < {P95_TARGET_S:g} s", f"{s['non_llm_p95_s']} s",
         "deterministic findings saved", s["non_llm_p95_s"] is not None and s["non_llm_p95_s"] < P95_TARGET_S),
        ("Zero lost jobs", str(s["lost_jobs"]), "unfinished runs with no queued message",
         s["lost_jobs"] == 0 and s["unfinished"] == 0),
        ("No failed runs", str(s["failed"]), ", ".join(s["failure_codes"]) or "none", s["failed"] == 0),
    ]  # fmt: skip
    if simulate:
        out.append((
            "Every pending run completes", f"{s['pending_completed']}/{s['went_pending']}",
            f"{s['pending_degraded']} degraded, {s['pending_still_open']} still open",
            s["went_pending"] > 0 and s["pending_completed"] == s["went_pending"],
        ))  # fmt: skip
    return out


def write_report(path: Path, s: dict[str, Any], args: argparse.Namespace, mode: str) -> None:
    rows = verdicts(s, args.simulate_rate_limit)
    lines = [
        "# Load test report",
        "",
        f"Generated by `scripts/load_test.py` on {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}.",
        "",
        "| Setting | Value |",
        "|---|---|",
        f"| Where | {args.note or '(no --note given)'} |",
        f"| Machine | {platform.system()} {platform.machine()}, Python {platform.python_version()} |",
        "| Database | local (refuses non-local URLs) |",
        f"| Worker | {mode} |",
        f"| Consumers | {s['consumers']} |",
        f"| Embedder | {args.embedder} |",
        f"| Submissions | {s['submissions']} × ~{s['words_per_draft']}-word text drafts, submitted concurrently |",
    ]
    if args.simulate_rate_limit:
        lines.append(
            f"| Simulated rate limit | every LLM call answers 429 for the first {args.rate_limit_window:g} s, "
            f"then succeeds; retry schedule {list(config.LLM_PENDING_RETRY_DELAYS_S)} s |"
        )
    lines += [
        "",
        "## Pass / fail",
        "",
        "| Target | Measured | Detail | Result |",
        "|---|---|---|---|",
        *[f"| {t} | {m} | {d} | {'PASS' if ok else 'FAIL'} |" for t, m, d, ok in rows],
        "",
        "## Numbers",
        "",
        "| Metric | Value |",
        "|---|---|",
        *[f"| `{k}` | {v} |" for k, v in s.items()],
        "",
        "Non-LLM path = submit → deterministic findings saved (`pending_since` for pending runs, "
        "else `finished_at` minus the LLM stage). Lost job = a run that never finished and has no "
        "message left in the queue.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


async def run_consumers(
    dsn: str, llm: SimulatedLLM, embedder: Any, stop: asyncio.Event
) -> list[asyncio.Task[None]]:
    from brandlens_worker.db import create_pool
    from brandlens_worker.jobs import build_registry
    from brandlens_worker.llm.cache import LLMCache
    from brandlens_worker.llm.router import LLMRouter
    from brandlens_worker.queue import PgmqBackend, consume

    pool = create_pool(dsn, max_size=config.DB_POOL_MAX)
    await pool.open()
    router = LLMRouter(
        [llm], cache=LLMCache(enabled=False), cooldown_s=config.LLM_RATE_LIMIT_COOLDOWN_S
    )
    # No "settings": in-process runs never send Discord notifications.
    services: dict[str, Any] = {"router": router, "embedder": embedder}
    backend = PgmqBackend(pool)
    queue = os.environ.get("PGMQ_QUEUE", "review_jobs")
    tasks = [
        asyncio.create_task(
            consume(
                queue,
                backend=backend,
                registry=build_registry(),
                stop=stop,
                pool=pool,
                services=services,
                max_poll_seconds=1,
            )
        )
        for _ in range(config.REVIEW_CONSUMERS)
    ]

    async def closer() -> None:
        await stop.wait()
        await asyncio.wait(consumers, timeout=30)
        await pool.close()

    consumers = list(tasks)
    tasks.append(asyncio.create_task(closer()))
    return tasks


async def amain(args: argparse.Namespace) -> int:
    dsn = args.db_url
    if not dsn:
        print('Set DATABASE_URL (eval "$(scripts/local-supabase-env.sh)") or pass --db-url.')
        return 2
    if not is_local(dsn):
        print("refusing: the load test runs against a LOCAL database only (owner's rule, Round 3).")
        return 2
    if args.n > 500:
        print("refusing: --n over 500")
        return 2

    inprocess = not args.external_worker
    stop = asyncio.Event()
    tasks: list[asyncio.Task[None]] = []
    llm = SimulatedLLM(0.0)
    if inprocess:
        if other_consumers(dsn):
            print("refusing: another worker is polling the queue. Stop `make dev-worker` first, or "
                  "use --external-worker.")  # fmt: skip
            return 2
        if args.embedder == "hash":
            embedder: Any = HashEmbedder()
        else:
            from brandlens_worker.embeddings import Embedder

            embedder = Embedder(
                os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
                os.environ.get("MODEL_CACHE_DIR", ".models"),
            )
            await asyncio.to_thread(embedder.embed, ["warm-up"])  # load the model before timing
        window = args.rate_limit_window if args.simulate_rate_limit else 0.0
        llm.limited_until = time.monotonic() + window
        tasks = await run_consumers(dsn, llm, embedder, stop)
        mode = "in-process consumers (worker code), simulated LLM" + (
            " with rate limit" if args.simulate_rate_limit else " (instant)"
        )
    else:
        mode = "external `make dev-worker` with the LLM providers in apps/worker/.env"

    allowance = (
        "insert into private.rate_counters (user_id, bucket, window_start, n) "
        "values (%s, 'submit', now(), -100000) on conflict (user_id, bucket) "
        "do update set window_start = now(), n = -100000"
    )
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute(allowance, (CREATOR,))
    t0 = time.time()
    try:
        with ThreadPoolExecutor(max_workers=min(args.n, 25)) as ex:
            ids = await asyncio.to_thread(
                lambda: list(ex.map(lambda i: submit(dsn, i), range(args.n)))
            )
    finally:
        with psycopg.connect(dsn, autocommit=True) as conn:
            conn.execute(
                "delete from private.rate_counters where user_id = %s and bucket = 'submit'",
                (CREATOR,),
            )
    print(
        f"submitted {len(ids)} runs in {time.time() - t0:.1f} s; waiting (timeout {args.timeout:g} s)…"
    )

    rows: list[dict[str, Any]] = []
    deadline = time.time() + args.timeout
    last = ""
    while time.time() < deadline:
        rows = await asyncio.to_thread(fetch_runs, dsn, ids)
        done = sum(r["status"] in ("done", "failed") for r in rows)
        pending = sum(bool(r["llm_pending"]) for r in rows)
        line = f"  {done}/{len(ids)} finished, {pending} AI check pending"
        if line != last:
            print(line)
            last = line
        if done == len(ids):
            break
        await asyncio.sleep(1)
    stop.set()
    if tasks:
        await asyncio.wait(tasks, timeout=30)

    s = summarise(rows, args.n, t0)
    s["consumers"] = config.REVIEW_CONSUMERS if inprocess else "the external worker's"
    if inprocess:
        s["simulated_llm_calls"] = llm.calls
        s["simulated_429s"] = llm.limited
    print(json.dumps(s, indent=2))
    results = verdicts(s, args.simulate_rate_limit)
    for t, m, _, ok in results:
        print(f"{'PASS' if ok else 'FAIL'}  {t}: {m}")
    if s["foreign_runs"]:
        print(
            f"WARNING: {s['foreign_runs']} runs were finished by another worker; numbers are mixed."
        )
    if args.report:
        write_report(args.report, s, args, mode)
        print(f"wrote {args.report}")

    if not args.keep:
        with psycopg.connect(dsn, autocommit=True) as conn:
            conn.execute(
                "delete from public.contents where org_id = %s and title like %s",
                (ORG, TITLE + "%"),
            )
    return 0 if all(ok for *_, ok in results) else 1


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--n", type=int, default=20, help="submissions (default 20, max 500)")
    ap.add_argument("--timeout", type=float, default=900, help="seconds to wait for every run")
    ap.add_argument("--db-url", default=os.environ.get("DATABASE_URL"), help="local Postgres URL")
    ap.add_argument("--simulate-rate-limit", action="store_true",
                    help="fake LLM answers 429 first, so runs go AI check pending")  # fmt: skip
    ap.add_argument("--rate-limit-window", type=float, default=45.0,
                    help="seconds the simulated LLM stays rate-limited (default 45)")  # fmt: skip
    ap.add_argument("--external-worker", action="store_true",
                    help="use the running `make dev-worker` (real LLM, spends quota)")  # fmt: skip
    ap.add_argument("--embedder", choices=["bge", "hash"], default="bge",
                    help="hash = sandbox stand-in when the model can't be downloaded")  # fmt: skip
    ap.add_argument("--report", type=Path, help="write a Markdown report here")
    ap.add_argument("--note", help="where it ran, for the report (e.g. 'MacBook Air M2')")
    ap.add_argument("--keep", action="store_true", help="keep the [load test] drafts afterwards")
    args = ap.parse_args()
    if args.external_worker and args.simulate_rate_limit:
        ap.error("--simulate-rate-limit needs the in-process worker (drop --external-worker)")
    sys.exit(asyncio.run(amain(args)))


if __name__ == "__main__":
    main()
