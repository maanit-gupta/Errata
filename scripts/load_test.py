"""P15 load test: N concurrent submissions of ~500-word drafts through enqueue_review(), then wait for
every run and report throughput, P50/P95 latency, degraded and failed runs.

Submits as the demo creator straight to Postgres (the same path the web server action takes after
saving a version). The 10-per-minute submit limit (migration …100020) would refuse most of a burst
from one user, so the harness gives that user a one-minute allowance for the burst and removes it
afterwards; the limiter itself is covered by supabase/tests/06_rate_limit.test.sql. Needs the worker running against the same DB.

    eval "$(scripts/local-supabase-env.sh)"            # or the cloud session-pooler DATABASE_URL
    cd apps/worker && uv run python ../../scripts/load_test.py --n 50
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import psycopg
from psycopg.rows import dict_row

from brandlens_worker.settings import get_settings

ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
CREATOR = "10000000-0000-4000-8000-000000000002"
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
# ~500 words with one blocker and one glossary issue, so every run exercises filters and the LLM.
BODY = PARA * 9 + "Download the Paywise app and lock in assured returns. Register now."


def submit(dsn: str, i: int) -> tuple[str, float]:
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
            (content_id, ORG, DIWALI, CREATOR, f"load test {i:02d}"),
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
    return str(row["run_id"]), time.time()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=50)
    parser.add_argument("--timeout", type=float, default=900)
    args = parser.parse_args()
    dsn = get_settings().database_url.get_secret_value()

    allowance = (
        "insert into private.rate_counters (user_id, bucket, window_start, n) "
        "values (%s, 'submit', now(), -100000) on conflict (user_id, bucket) "
        "do update set window_start = now(), n = -100000"
    )
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute(allowance, (CREATOR,))
    t0 = time.time()
    try:
        with ThreadPoolExecutor(max_workers=min(args.n, 25)) as pool:
            runs = list(pool.map(lambda i: submit(dsn, i), range(args.n)))
    finally:
        with psycopg.connect(dsn, autocommit=True) as conn:
            conn.execute(
                "delete from private.rate_counters where user_id = %s and bucket = 'submit'",
                (CREATOR,),
            )
    submit_s = time.time() - t0
    ids = [r for r, _ in runs]
    print(f"submitted {len(ids)} runs in {submit_s:.1f}s; waiting…")

    rows: list[dict[str, Any]] = []
    with psycopg.connect(dsn, autocommit=True, row_factory=dict_row) as conn:
        deadline = time.time() + args.timeout
        while time.time() < deadline:
            rows = conn.execute(
                "select id::text, status::text, degraded, error_code, timings, "
                "extract(epoch from finished_at - created_at)::float as secs, "
                "extract(epoch from finished_at)::float as finished "
                "from public.review_runs where id = any(%s::uuid[])",
                (ids,),
            ).fetchall()
            if sum(r["status"] in ("done", "failed") for r in rows) == len(ids):
                break
            time.sleep(1)

    finished = [r for r in rows if r["status"] in ("done", "failed")]
    secs = sorted(r["secs"] for r in finished)
    wall = max(r["finished"] for r in finished) - t0 if finished else float("nan")
    llm_ms = [r["timings"].get("llm") for r in finished if r["timings"].get("llm")]
    print(
        json.dumps(
            {
                "submissions": args.n,
                "words": len(BODY.split()),
                "finished": len(finished),
                "failed": sum(r["status"] == "failed" for r in finished),
                "errors": sorted({r["error_code"] for r in finished if r["error_code"]}),
                "degraded": sum(bool(r["degraded"]) for r in finished),
                "wall_s": round(wall, 1),
                "throughput_per_min": round(len(finished) / wall * 60, 1) if finished else 0,
                "p50_s": round(statistics.median(secs), 1) if secs else None,
                "p95_s": round(statistics.quantiles(secs, n=20)[18], 1) if len(secs) > 1 else None,
                "max_s": round(max(secs), 1) if secs else None,
                "llm_ms_p50": round(statistics.median(llm_ms)) if llm_ms else None,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
