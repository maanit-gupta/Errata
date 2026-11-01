"""`/v1/heroes`: worker endpoints for the Round 3 extras that need the worker's local model.

Today: `POST /v1/heroes/simulate-rule` (Hero 5, GCS shadow sandbox). Every call needs the caller's
Supabase session token (`Authorization: Bearer <access token>`), verified with Supabase Auth, and a
brand admin or manager membership in the rule's organisation. Scope comes from the rule, never from
the caller. Inputs are validated with Pydantic; logs carry IDs, counts and timings only.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Any, Protocol
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from brandlens_worker.heroes.gcs_shadow import SHADOW_SAMPLE, SampleFinding, project
from brandlens_worker.mcp.auth import RateLimiter

log = logging.getLogger(__name__)

ALLOWED_ROLES = {"brand_admin", "manager"}


class SimulateRuleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    rule_id: UUID
    do_examples: list[str] = Field(min_length=1, max_length=10)
    dont_examples: list[str] = Field(default_factory=list, max_length=10)
    include_simulated: bool = False

    def clean(self) -> tuple[list[str], list[str]]:
        return _cut(self.do_examples), _cut(self.dont_examples)


def _cut(xs: list[str]) -> list[str]:
    return [x[:300] for x in xs if x.strip()]


class UserVerifier(Protocol):
    async def user_id(self, token: str) -> str | None: ...


class HeroStore(Protocol):
    async def rule(self, rule_id: str) -> dict[str, Any] | None: ...
    async def role(self, user_id: str, org_id: str) -> str | None: ...
    async def current_gcs(
        self, org_id: str, rule_id: str, include_simulated: bool
    ) -> dict[str, Any] | None: ...
    async def sample(
        self, org_id: str, rule_id: str, include_simulated: bool, limit: int
    ) -> list[SampleFinding]: ...


class SupabaseUserVerifier:
    """Asks Supabase Auth who owns the token (`GET /auth/v1/user`); caches answers for a minute."""

    def __init__(self, supabase_url: str, api_key: str, ttl_s: float = 60.0) -> None:
        self.url = supabase_url.rstrip("/") + "/auth/v1/user"
        self.api_key = api_key
        self.ttl_s = ttl_s
        self._cache: dict[str, tuple[float, str]] = {}

    async def user_id(self, token: str) -> str | None:
        key = hashlib.sha256(token.encode()).hexdigest()
        hit = self._cache.get(key)
        now = time.monotonic()
        if hit and hit[0] > now:
            return hit[1]
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                self.url, headers={"apikey": self.api_key, "Authorization": f"Bearer {token}"}
            )
        if res.status_code != 200:
            return None
        uid = res.json().get("id")
        if not isinstance(uid, str):
            return None
        if len(self._cache) > 512:
            self._cache.clear()
        self._cache[key] = (now + self.ttl_s, uid)
        return uid


class PgHeroStore:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def rule(self, rule_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select id::text as id, org_id::text as org_id, code, title, body, "
                "status::text as status from public.rule_cards where id = %s",
                (rule_id,),
            )
            row: dict[str, Any] | None = await cur.fetchone()
            return row

    async def role(self, user_id: str, org_id: str) -> str | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select role::text as role from public.memberships "
                "where user_id = %s and org_id = %s",
                (user_id, org_id),
            )
            row = await cur.fetchone()
        return str(row["role"]) if row else None

    async def current_gcs(
        self, org_id: str, rule_id: str, include_simulated: bool
    ) -> dict[str, Any] | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select n, dismissal_rate, override_rate, low_confidence_rate, gcs, status "
                "from public.rule_gcs(%s, now() - interval '90 days', %s) where rule_id = %s",
                (org_id, include_simulated, rule_id),
            )
            row: dict[str, Any] | None = await cur.fetchone()
            return row

    async def sample(
        self, org_id: str, rule_id: str, include_simulated: bool, limit: int
    ) -> list[SampleFinding]:
        # Same population as rule_gcs: this rule version, not superseded, last 90 days,
        # simulated contents left out unless asked.
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select f.id::text as id, f.quote, "
                "(f.status = 'dismissed' and f.dismiss_reason = 'doesnt_apply') as fp "
                "from public.findings f join public.versions v on v.id = f.version_id "
                "join public.contents c on c.id = v.content_id "
                "where f.org_id = %s and f.rule_id = %s and f.status <> 'superseded' "
                "and f.created_at >= now() - interval '90 days' and (%s or not c.simulated) "
                "order by f.created_at desc, f.id limit %s",
                (org_id, rule_id, include_simulated, limit),
            )
            return [
                SampleFinding(r["id"], r["quote"] or "", bool(r["fp"]))
                for r in await cur.fetchall()
            ]


def build_router() -> APIRouter:
    router = APIRouter(prefix="/v1/heroes")
    limiter = RateLimiter(per_minute=30)

    async def caller(request: Request) -> str:
        services: dict[str, Any] = getattr(request.app.state, "services", {}) or {}
        verifier: UserVerifier | None = services.get("user_verifier")
        if verifier is None:
            raise HTTPException(503, "unavailable")
        header = request.headers.get("authorization", "")
        token = header[7:].strip() if header[:7].lower() == "bearer " else ""
        uid = await verifier.user_id(token) if token else None
        if uid is None:
            raise HTTPException(401, "sign in again", headers={"WWW-Authenticate": "Bearer"})
        if not limiter.allow(uid):
            raise HTTPException(429, "too many simulations; try again in a minute")
        return uid

    @router.post("/simulate-rule")
    async def simulate_rule(body: SimulateRuleInput, request: Request) -> dict[str, Any]:
        uid = await caller(request)
        services: dict[str, Any] = request.app.state.services
        store: HeroStore | None = services.get("hero_store")
        embedder = services.get("embedder")
        if store is None or embedder is None:
            raise HTTPException(503, "unavailable")
        rule = await store.rule(str(body.rule_id))
        role = await store.role(uid, rule["org_id"]) if rule else None
        if rule is None or role not in ALLOWED_ROLES:
            raise HTTPException(404, "rule not found")  # same answer: no existence leak
        started = time.perf_counter()
        current = await store.current_gcs(rule["org_id"], rule["id"], body.include_simulated)
        sample = await store.sample(
            rule["org_id"], rule["id"], body.include_simulated, SHADOW_SAMPLE
        )
        do, dont = body.clean()
        result = await asyncio.to_thread(
            project,
            rule_code=rule["code"],
            current=current,
            sample=sample,
            rule_body=rule["body"],
            do_examples=do,
            dont_examples=dont,
            embed=embedder.embed,
        )
        ms = round((time.perf_counter() - started) * 1000)
        log.info(
            "hero simulate-rule",
            extra={"user_id": uid, "rule_id": rule["id"], "sample": len(sample), "ms": ms},
        )
        return {**result.to_json(), "elapsed_ms": ms, "include_simulated": body.include_simulated}

    return router
