"""HTTP surface for the worker. The queue consumer arrives in P03.

Run with `uvicorn --factory brandlens_worker.main:create_app` so settings are validated at startup.
"""

import logging

from fastapi import FastAPI

from brandlens_worker import __version__
from brandlens_worker.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level)

    app = FastAPI(title="BrandLens worker", version=__version__)

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        # Never include secrets here.
        return {"status": "ok", "env": settings.env, "provider": settings.llm_provider}

    return app
