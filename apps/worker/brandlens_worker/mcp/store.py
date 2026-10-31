"""Data access for the MCP tools. `McpStore` is the seam: tests use a fake, the worker uses
`PgMcpStore`. Every query is scoped to the caller's org_id; facts and retrieval go through the
service-role SQL functions that already exclude expired and never_send rows (pgTAP 03 and 07)."""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np

from brandlens_worker.mcp.auth import McpAuth
from brandlens_worker.pipeline.types import Vault


@dataclass(frozen=True)
class Campaign:
    id: str
    name: str
    status: str
    starts_on: str | None
    ends_on: str | None


@dataclass
class McpVault:
    """The deterministic vault for a precheck, plus the codes the MCP must never echo back."""

    vault: Vault
    internal_codes: set[str] = field(default_factory=set)


class McpStore(Protocol):
    async def resolve(self, key_hash: str) -> McpAuth | None: ...
    async def find_active_campaign(self, org_id: str, query: str) -> Campaign | None: ...
    async def active_campaigns(self, org_id: str) -> list[Campaign]: ...
    async def campaign(self, org_id: str, campaign_id: str) -> Campaign | None: ...
    async def campaign_facts(self, org_id: str, campaign_id: str) -> list[dict[str, Any]]: ...
    async def match(
        self,
        org_id: str,
        campaign_id: str,
        embedding: Sequence[float],
        k: int,
        dimensions: list[str] | None = None,
    ) -> list[dict[str, Any]]: ...
    async def rule_cards(self, org_id: str, ids: list[str]) -> list[dict[str, Any]]: ...
    async def glossary(self, org_id: str) -> list[dict[str, Any]]: ...
    async def load_vault(self, org_id: str, campaign: Campaign) -> McpVault: ...
    async def audit(self, auth: McpAuth, event: dict[str, Any]) -> None: ...


def _campaign(row: dict[str, Any]) -> Campaign:
    return Campaign(
        id=str(row["id"]),
        name=row["name"],
        status=row["status"],
        starts_on=str(row["starts_on"]) if row["starts_on"] else None,
        ends_on=str(row["ends_on"]) if row["ends_on"] else None,
    )


def _like_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class PgMcpStore:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def resolve(self, key_hash: str) -> McpAuth | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select key_id::text as k, org_id::text as o, user_id::text as u, role::text as r "
                "from public.resolve_mcp_key(%s)",
                (key_hash,),
            )
            row = await cur.fetchone()
        return McpAuth(row["k"], row["o"], row["u"], row["r"]) if row else None

    async def find_active_campaign(self, org_id: str, query: str) -> Campaign | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select id, name, status::text as status, starts_on, ends_on "
                "from public.campaigns where org_id = %s and status = 'active' "
                "and name ilike '%%' || %s || '%%' escape '\\' "
                "order by starts_on desc nulls last limit 1",
                (org_id, _like_escape(query)),
            )
            row = await cur.fetchone()
        return _campaign(row) if row else None

    async def active_campaigns(self, org_id: str) -> list[Campaign]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select id, name, status::text as status, starts_on, ends_on "
                "from public.campaigns where org_id = %s and status = 'active' order by name",
                (org_id,),
            )
            return [_campaign(r) for r in await cur.fetchall()]

    async def campaign(self, org_id: str, campaign_id: str) -> Campaign | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select id, name, status::text as status, starts_on, ends_on "
                "from public.campaigns where org_id = %s and id = %s",
                (org_id, campaign_id),
            )
            row = await cur.fetchone()
        return _campaign(row) if row else None

    async def campaign_facts(self, org_id: str, campaign_id: str) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select code, kind, statement, value, required_disclaimer, valid_until "
                "from public.mcp_campaign_facts(%s, %s)",
                (org_id, campaign_id),
            )
            return list(await cur.fetchall())

    async def match(
        self,
        org_id: str,
        campaign_id: str,
        embedding: Sequence[float],
        k: int,
        dimensions: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        from brandlens_worker.embeddings import to_pgvector

        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select id::text as id, code, kind, dimension::text as dimension, title, content, "
                "severity::text as severity, value, round(similarity::numeric, 4)::float as score "
                "from public.match_vault(%s::uuid, %s::uuid, %s::extensions.vector, %s::int, "
                "%s::public.dimension[])",
                (org_id, campaign_id, to_pgvector(np.asarray(embedding)), k, dimensions),
            )
            return list(await cur.fetchall())

    async def rule_cards(self, org_id: str, ids: list[str]) -> list[dict[str, Any]]:
        if not ids:
            return []
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select id::text as id, code, dimension::text as dimension, title, summary, body, "
                "examples, severity::text as severity, source_page from public.rule_cards "
                "where org_id = %s and id = any(%s::uuid[]) and status = 'approved' "
                "and not never_send",
                (org_id, ids),
            )
            return list(await cur.fetchall())

    async def glossary(self, org_id: str) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "select code, preferred, variants, banned from public.glossary_terms "
                "where org_id = %s order by code",
                (org_id,),
            )
            return list(await cur.fetchall())

    async def load_vault(self, org_id: str, campaign: Campaign) -> McpVault:
        from uuid import UUID

        from brandlens_worker.jobs.review_version import load_vault

        async with self.pool.connection() as conn:
            vault = await load_vault(conn, UUID(org_id), campaign.id, campaign.name)
            cur = await conn.execute(
                "select code from public.facts where org_id = %s and never_send "
                "union select code from public.rule_cards where org_id = %s and never_send",
                (org_id, org_id),
            )
            internal = {r["code"] for r in await cur.fetchall()}
        return McpVault(vault, internal)

    async def audit(self, auth: McpAuth, event: dict[str, Any]) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                "insert into public.audit_events (org_id, actor_id, event) values (%s, %s, %s)",
                (auth.org_id, auth.user_id, json.dumps({**event, "key_id": auth.key_id})),
            )
