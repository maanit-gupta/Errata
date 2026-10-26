"""HTTP surface and lifecycle for the worker: health check, queue consumers, dev smoke endpoint.

Run with `uvicorn --factory brandlens_worker.main:create_app` so settings are validated at startup.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from brandlens_worker import __version__, config
from brandlens_worker.jobs import build_registry
from brandlens_worker.logs import configure_logging
from brandlens_worker.settings import Settings, get_settings

log = logging.getLogger(__name__)

DEV_ENVS = {"development", "dev", "local"}


class SmokeOutput(BaseModel):
    brand: str
    word_count: int
    ok: bool


def create_app(settings: Settings | None = None, *, run_queue: bool = True) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        state: dict[str, Any] = {"tasks": [], "stop": asyncio.Event(), "pool": None}
        app.state.services = {}
        if run_queue:
            await _start(settings, state, app)
        try:
            yield
        finally:
            await _stop(state, app)

    app = FastAPI(title="BrandLens worker", version=__version__, lifespan=lifespan)

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        # Never include secrets here.
        return {"status": "ok", "env": settings.env, "provider": settings.llm_provider}

    if settings.env.lower() in DEV_ENVS:

        @app.post("/dev/llm-smoke")
        async def llm_smoke(provider: str | None = None) -> dict[str, Any]:
            """Dev-only: one tiny structured call through the router, to check keys and models."""
            from brandlens_worker.llm.base import DegradedError
            from brandlens_worker.llm.router import build_router
            from brandlens_worker.prompts import load_prompt
            from brandlens_worker.tracing import Tracer

            s = settings
            if provider:
                if provider not in ("groq", "gemini"):
                    raise HTTPException(400, "provider must be groq or gemini")
                s = settings.model_copy(
                    update={"llm_provider": provider, "llm_fallback_provider": "none"}
                )
            router = build_router(s)
            tracer = app.state.services.get("tracer") or Tracer.from_settings(s)
            system, version = load_prompt("smoke")
            started = time.perf_counter()
            with tracer.trace_run("smoke", name="llm_smoke"):
                try:
                    out, meta = await router.generate(
                        system,
                        "<draft>Start a SIP on PayWise this Diwali.</draft>",
                        SmokeOutput,
                        prompt_version=version,
                    )
                except DegradedError as exc:
                    return {"valid": False, "degraded": True, "error": str(exc)}
                tracer.generation(
                    "llm_smoke",
                    prompt_version=version,
                    model=meta.model,
                    input_meta={"draft_words": 7},
                    output=out.model_dump(),
                    usage={"input": meta.input_tokens or 0, "output": meta.output_tokens or 0},
                    latency_ms=meta.latency_ms,
                )
                trace_id = tracer.current_trace_id()
            tracer.flush()
            return {
                "valid": True,
                "provider": meta.provider,
                "model": meta.model,
                "latency_ms": round((time.perf_counter() - started) * 1000),
                "validation_retries": meta.validation_retries,
                "prompt_version": version,
                "output": out.model_dump(),
                "trace_id": trace_id,
            }

    return app


async def _start(settings: Settings, state: dict[str, Any], app: FastAPI) -> None:
    from brandlens_worker.db import create_pool
    from brandlens_worker.queue import PgmqBackend, consume
    from brandlens_worker.tracing import Tracer

    pool = create_pool(settings.database_url.get_secret_value())
    await pool.open(wait=False)
    state["pool"] = pool
    tracer = Tracer.from_settings(settings, enabled=settings.env.lower() != "test")
    services: dict[str, Any] = {"settings": settings, "tracer": tracer}
    app.state.services = services

    registry = build_registry()
    backend = PgmqBackend(pool)
    for queue in (settings.pgmq_queue, config.VAULT_QUEUE):
        state["tasks"].append(
            asyncio.create_task(
                consume(
                    queue,
                    backend=backend,
                    registry=registry,
                    stop=state["stop"],
                    pool=pool,
                    services=services,
                ),
                name=f"consume:{queue}",
            )
        )


async def _stop(state: dict[str, Any], app: FastAPI) -> None:
    state["stop"].set()
    tasks: list[asyncio.Task[None]] = state["tasks"]
    if tasks:
        # A consumer finishes its current job; a long-poll returns within max_poll_seconds.
        _, pending = await asyncio.wait(tasks, timeout=15)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
    tracer = getattr(app.state, "services", {}).get("tracer")
    if tracer is not None:
        tracer.shutdown()
    if state["pool"] is not None:
        await state["pool"].close()
