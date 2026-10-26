"""Lazily-built shared clients for jobs, cached in `JobContext.services`. Tests inject fakes."""

from __future__ import annotations

from typing import Any

from brandlens_worker.queue import JobContext


def _settings(ctx: JobContext) -> Any:
    settings = ctx.services.get("settings")
    if settings is None:
        raise RuntimeError("job services are missing settings")
    return settings


def get_router(ctx: JobContext) -> Any:
    if "router" not in ctx.services:
        from brandlens_worker.llm.router import build_router

        ctx.services["router"] = build_router(_settings(ctx))
    return ctx.services["router"]


def get_embedder(ctx: JobContext) -> Any:
    if "embedder" not in ctx.services:
        from brandlens_worker.embeddings import Embedder

        s = _settings(ctx)
        ctx.services["embedder"] = Embedder(s.embedding_model, s.model_cache_dir)
    return ctx.services["embedder"]


def get_storage(ctx: JobContext) -> Any:
    if "storage" not in ctx.services:
        from brandlens_worker.storage import Storage

        s = _settings(ctx)
        ctx.services["storage"] = Storage(s.supabase_url, s.supabase_secret_key.get_secret_value())
    return ctx.services["storage"]


def get_tracer(ctx: JobContext) -> Any:
    if "tracer" not in ctx.services:
        from brandlens_worker.tracing import Tracer

        ctx.services["tracer"] = Tracer(None)
    return ctx.services["tracer"]
