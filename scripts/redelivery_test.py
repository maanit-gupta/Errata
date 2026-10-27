"""P15 restart test: a worker that dies mid-job leaves its pgmq message invisible until the visibility
timeout (VT) expires; then a live worker reads it again (read_ct 2) and the idempotent run completes.

Simulates the crash without killing anyone's process: in one transaction it submits a draft as the
demo creator, reads (claims) the message with a short VT the way a consumer does, marks the run
`running` and never finishes. Needs the worker running against the same DB.

    eval "$(scripts/local-supabase-env.sh)"
    cd apps/worker && uv run python ../../scripts/redelivery_test.py [--vt 15]
"""

from __future__ import annotations

import argparse
import json
import time
import uuid

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
BODY = "Start a SIP on the Paywise app and lock in assured returns this Diwali. Register now."


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vt", type=int, default=15)
    args = parser.parse_args()
    s = get_settings()
    queue = s.pgmq_queue
    content_id = str(uuid.uuid4())

    with psycopg.connect(
        s.database_url.get_secret_value(), autocommit=True, row_factory=dict_row
    ) as conn:
        with conn.transaction():
            conn.execute(
                "select set_config('request.jwt.claims', %s, true)",
                (json.dumps({"sub": CREATOR, "role": "authenticated"}),),
            )
            conn.execute("set local role authenticated")
            conn.execute(
                "insert into public.contents (id, org_id, campaign_id, owner_id, title, channel) "
                "values (%s, %s, %s, %s, 'redelivery test', 'instagram_caption')",
                (content_id, ORG, DIWALI, CREATOR),
            )
            conn.execute(
                "insert into public.versions (content_id, body, format, intent) "
                "values (%s, %s, 'text', %s)",
                (content_id, BODY, json.dumps(INTENT)),
            )
            run = conn.execute(
                "select public.enqueue_review(current_version_id)::text as id "
                "from public.contents where id = %s",
                (content_id,),
            ).fetchone()
            assert run is not None
            conn.execute("reset role")
            # The "crashed worker": claim the message as a consumer would, start, never finish.
            msg = conn.execute(
                "select msg_id, read_ct from pgmq.read(%s, %s, 1)", (queue, args.vt)
            ).fetchone()
            assert msg is not None and msg["read_ct"] == 1
            conn.execute(
                "update public.review_runs set status = 'running', started_at = now() "
                "where id = %s",
                (run["id"],),
            )
        t0 = time.time()
        print(f"run {run['id']}: message {msg['msg_id']} claimed and abandoned (vt {args.vt}s)")

        status = "running"
        while time.time() - t0 < args.vt + 180:
            r = conn.execute(
                "select status::text, degraded, error_code, "
                "(select count(*) from public.findings f where f.run_id = r.id) as findings "
                "from public.review_runs r where id = %s",
                (run["id"],),
            ).fetchone()
            assert r is not None
            if r["status"] != status:
                status = r["status"]
                print(f"  +{time.time() - t0:5.1f}s status={status}")
            if status in ("done", "failed"):
                break
            time.sleep(0.5)
        archived = conn.execute(
            f"select read_ct from pgmq.a_{queue} where msg_id = %s", (msg["msg_id"],)
        ).fetchone()
        live = conn.execute(
            f"select count(*) as n from pgmq.q_{queue} where msg_id = %s", (msg["msg_id"],)
        ).fetchone()
        print(
            json.dumps(
                {
                    "final_status": status,
                    "seconds_after_crash": round(time.time() - t0, 1),
                    "findings": r["findings"],
                    "degraded": r["degraded"],
                    "error_code": r["error_code"],
                    "message_still_queued": bool(live and live["n"]),
                    "archived_read_ct": archived["read_ct"] if archived else None,
                },
                indent=2,
            )
        )
        assert status == "done", status
        assert time.time() - t0 >= args.vt - 1  # nobody could see it before the VT expired


if __name__ == "__main__":
    main()
