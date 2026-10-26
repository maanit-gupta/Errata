"""Dev tool: upload a brand guide and run `ingest_guide` in-process against the configured DB.

    eval "$(scripts/local-supabase-env.sh)"
    cd apps/worker
    uv run python ../../scripts/ingest_guide_demo.py ../../fixtures/paywise/guide.pdf

Prints the draft rule cards it created. Uses real LLM calls (fictional demo data only).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import demo_data as d
from brandlens_worker.db import create_pool
from brandlens_worker.jobs.ingest_guide import ingest_guide
from brandlens_worker.queue import JobContext, Message
from brandlens_worker.settings import get_settings
from brandlens_worker.storage import Storage
from brandlens_worker.tracing import Tracer


async def run(path: Path, org_id: str) -> int:
    settings = get_settings()
    storage = Storage(settings.supabase_url, settings.supabase_secret_key.get_secret_value())
    guide_id = str(uuid.uuid4())
    kind = "pdf" if path.suffix.lower() == ".pdf" else "docx"
    object_path = f"{org_id}/{guide_id}/{path.name}"
    content_type = (
        "application/pdf"
        if kind == "pdf"
        else ("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    )
    await storage.upload("guides", object_path, path.read_bytes(), content_type)

    pool = create_pool(settings.database_url.get_secret_value())
    await pool.open()
    tracer = Tracer.from_settings(settings)
    try:
        async with pool.connection() as conn:
            await conn.execute(
                "insert into public.brand_guides (id, org_id, title, source_kind, storage_path) "
                "values (%s, %s, %s, %s, %s)",
                (guide_id, org_id, path.stem, kind, object_path),
            )
        ctx = JobContext(
            queue="vault_jobs",
            message=Message(
                msg_id=0,
                read_ct=1,
                payload={"job": "ingest_guide", "org_id": org_id, "guide_id": guide_id},
            ),
            pool=pool,
            services={"settings": settings, "tracer": tracer, "storage": storage},
        )
        await ingest_guide(ctx)
        async with pool.connection() as conn:
            cur = await conn.execute(
                "select code, version, dimension::text as dim, severity::text as sev, "
                "source_page, title "
                "from public.rule_cards where guide_id = %s order by code",
                (guide_id,),
            )
            rows = await cur.fetchall()
        print(f"guide {guide_id}: {len(rows)} draft rule cards")
        for r in rows:
            print(
                f"  {r['code']:<6} v{r['version']}  {r['dim']:<7} {r['sev']:<10} "
                f"p{r['source_page']}  {r['title']}"
            )
        return 0 if len(rows) >= 6 else 1
    finally:
        tracer.shutdown()
        await pool.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("path", type=Path)
    parser.add_argument("--org", default=d.ORG_ID)
    args = parser.parse_args()
    return asyncio.run(run(args.path, args.org))


if __name__ == "__main__":
    raise SystemExit(main())
