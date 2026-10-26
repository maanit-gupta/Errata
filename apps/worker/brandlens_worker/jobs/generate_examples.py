"""Job `generate_examples` (vault_jobs): three do/don't examples for a rule that crossed into
UNCLEAR (SPEC §11), stored as a pending `example_suggestions` row for a brand admin to approve.

One LLM call. Only the rule and redacted dismissed quotes are sent. If no provider works, the
placeholder row `flag_unclear_rules` made is removed so the rule is flagged again later.
"""

from __future__ import annotations

import logging
from uuid import UUID

from psycopg.types.json import Jsonb
from pydantic import BaseModel

from brandlens_worker.jobs.common import get_router, get_tracer
from brandlens_worker.llm.base import DegradedError
from brandlens_worker.notify import notify_unclear_rule
from brandlens_worker.pipeline.examples import ExamplesOutput, build_message, novel
from brandlens_worker.prompts import load_prompt
from brandlens_worker.queue import JobContext, JobError

log = logging.getLogger(__name__)


class GenerateExamplesPayload(BaseModel):
    org_id: UUID
    rule_id: UUID
    gcs: int | None = None


async def generate_examples(ctx: JobContext) -> None:
    p = GenerateExamplesPayload.model_validate(ctx.message.payload)
    async with ctx.pool.connection() as conn:
        cur = await conn.execute(
            "select code, title, body, examples from public.rule_cards "
            "where id = %s and org_id = %s",
            (p.rule_id, p.org_id),
        )
        rule = await cur.fetchone()
        if rule is None:
            raise JobError("rule_not_found")
        cur = await conn.execute(
            "select quote from public.findings where rule_id = %s and status = 'dismissed' "
            "and dismiss_reason = 'doesnt_apply' order by created_at desc limit 40",
            (p.rule_id,),
        )
        dismissed = [r["quote"] for r in await cur.fetchall()]

    system, prompt_version = load_prompt("examples")
    user = build_message(rule["code"], rule["title"], rule["body"], rule["examples"], dismissed)
    try:
        out, meta = await get_router(ctx).generate(
            system, user, ExamplesOutput, prompt_version=prompt_version, temperature=0.4
        )
    except DegradedError:
        async with ctx.pool.connection() as conn:
            await conn.execute(
                "delete from public.example_suggestions where rule_id = %s and status = 'pending' "
                "and examples = '[]'::jsonb",
                (p.rule_id,),
            )
        log.warning("examples not generated: llm unavailable", extra={"rule_id": str(p.rule_id)})
        return
    examples = [
        e | {"model_version": meta.model, "prompt_version": prompt_version}
        for e in novel(out, dismissed)
    ]
    get_tracer(ctx).generation(
        "generate_examples",
        prompt_version=prompt_version,
        model=meta.model,
        input_meta={"rule_id": str(p.rule_id), "dismissed": len(dismissed)},
        output={"examples": len(examples)},
        usage={"input": meta.input_tokens or 0, "output": meta.output_tokens or 0},
        latency_ms=meta.latency_ms,
        metadata={"provider": meta.provider, "cache_hit": meta.cache_hit},
    )

    async with ctx.pool.connection() as conn, conn.transaction():
        cur = await conn.execute(
            "update public.example_suggestions set examples = %s "
            "where rule_id = %s and status = 'pending' and examples = '[]'::jsonb returning id",
            (Jsonb(examples), p.rule_id),
        )
        if await cur.fetchone() is None:
            await conn.execute(
                "insert into public.example_suggestions (org_id, rule_id, examples) "
                "values (%s, %s, %s)",
                (p.org_id, p.rule_id, Jsonb(examples)),
            )
    if "settings" in ctx.services:
        notify_unclear_rule(ctx.services["settings"], code=rule["code"], gcs=p.gcs)
    log.info(
        "examples suggested",
        extra={"rule_id": str(p.rule_id), "examples": len(examples), "dismissed": len(dismissed)},
    )
