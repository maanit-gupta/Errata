"""Hero 5 against Postgres (TEST_DATABASE_URL): the real store, 30 findings on TV-04, the backtest
run twice. PASS IF: a 30-draft backtest finishes in under 60 s and identical inputs give identical
output. Uses a deterministic stand-in embedder here; on the real stack the worker uses bge-small."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from brandlens_worker.heroes.api import PgHeroStore, build_router
from tests.test_gcs_shadow import KeywordEmbedder
from tests.test_llm_pending import CREATOR, DIWALI, ORG, needs_db, pool  # noqa: F401

ADMIN = "10000000-0000-4000-8000-000000000001"
TITLE = "[pytest gcs shadow] "


class AdminVerifier:
    async def user_id(self, token: str) -> str | None:
        return ADMIN if token == "tok" else None


async def seed_findings(pool: Any, n: int) -> str:  # noqa: F811
    async with pool.connection() as conn:
        cur = await conn.execute(
            "select id::text as id from public.rule_cards where org_id = %s and code = 'TV-04' "
            "and status = 'approved'",
            (ORG,),
        )
        rule_id = (await cur.fetchone())["id"]
        cid = str(uuid.uuid4())
        await conn.execute(
            "insert into public.contents (id, org_id, campaign_id, owner_id, title, channel) "
            "values (%s, %s, %s, %s, %s, 'instagram_post')",
            (cid, ORG, DIWALI, CREATOR, TITLE + cid[:8]),
        )
        for i in range(n):
            vid = (
                await (
                    await conn.execute(
                        "insert into public.versions (content_id, n, body, format, intent) "
                        "values (%s, 0, 'x', 'text', '{}') returning id::text as id",
                        (cid,),
                    )
                ).fetchone()
            )["id"]
            rid = (
                await (
                    await conn.execute(
                        "insert into public.review_runs (org_id, version_id, status) values (%s, %s, 'done') "
                        "returning id::text as id",
                        (ORG, vid),
                    )
                ).fetchone()
            )["id"]
            fp = i % 2 == 0
            await conn.execute(
                "insert into public.findings (org_id, version_id, run_id, dimension, rule_id, quote, "
                "span, severity, confidence, source, explanation, status, dismiss_reason) values "
                "(%s, %s, %s, 'tone', %s, %s, '{\"start\":0,\"end\":1}', 'suggestion', 0.9, 'llm', "
                "'x', %s, %s)",
                (ORG, vid, rid, rule_id,
                 "a festive Diwali glow" if fp else "hit the jackpot on your SIP",
                 "dismissed" if fp else "accepted", "doesnt_apply" if fp else None),
            )  # fmt: skip
    return rule_id


@needs_db
async def test_backtest_30_drafts_is_fast_and_deterministic(pool: Any) -> None:  # noqa: F811
    rule_id = await seed_findings(pool, 30)
    try:
        app = FastAPI()
        app.state.services = {"user_verifier": AdminVerifier(), "hero_store": PgHeroStore(pool),
                              "embedder": KeywordEmbedder()}  # fmt: skip
        app.include_router(build_router())
        body = {"rule_id": rule_id, "do_examples": ["festive Diwali fun", "light up your SIP"],
                "dont_examples": ["Diwali jackpot"]}  # fmt: skip
        with TestClient(app) as c:
            t = time.perf_counter()
            a = c.post(
                "/v1/heroes/simulate-rule", json=body, headers={"Authorization": "Bearer tok"}
            )
            took = time.perf_counter() - t
            b = c.post(
                "/v1/heroes/simulate-rule", json=body, headers={"Authorization": "Bearer tok"}
            )
        assert a.status_code == 200, a.text
        ra, rb = a.json(), b.json()
        ra.pop("elapsed_ms"), rb.pop("elapsed_ms")
        assert json.dumps(ra, sort_keys=True) == json.dumps(rb, sort_keys=True)
        assert took < 60
        assert ra["status"] == "projection" and ra["sample_size"] == 30
        assert ra["false_positives_removed"] == 15 and ra["true_positives_lost"] == 0
        # "Before" is the dashboard's own number from SQL rule_gcs.
        async with pool.connection() as conn:
            cur = await conn.execute(
                "select gcs from public.rule_gcs(%s, now() - interval '90 days', false) "
                "where rule_id = %s", (ORG, rule_id))  # fmt: skip
            assert ra["current_gcs"] == (await cur.fetchone())["gcs"]
    finally:
        async with pool.connection() as conn:
            await conn.execute("delete from public.contents where title like %s", (TITLE + "%",))


@needs_db
async def test_insufficient_data_on_the_real_store(pool: Any) -> None:  # noqa: F811
    rule_id = await seed_findings(pool, 5)
    try:
        app = FastAPI()
        app.state.services = {"user_verifier": AdminVerifier(), "hero_store": PgHeroStore(pool),
                              "embedder": KeywordEmbedder()}  # fmt: skip
        app.include_router(build_router())
        with TestClient(app) as c:
            r = c.post("/v1/heroes/simulate-rule", json={"rule_id": rule_id, "do_examples": ["x"]},
                       headers={"Authorization": "Bearer tok"}).json()  # fmt: skip
        assert r["status"] == "insufficient_data" and r["projected_gcs"] is None
    finally:
        async with pool.connection() as conn:
            await conn.execute("delete from public.contents where title like %s", (TITLE + "%",))
