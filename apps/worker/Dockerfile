# BrandLens worker: FastAPI + pgmq consumer. Build context: apps/worker.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_HTTP_TIMEOUT=600 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    MODEL_CACHE_DIR=/app/.models \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.9.9 /uv /usr/local/bin/uv

# onnxruntime (fastembed) needs libgomp; image OCR (P11) uses the Tesseract binary + English data.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

# Build as the runtime user so files are owned by it from the start: a final `chown -R` layer
# would duplicate the ~1 GB venv in the image (P15).
RUN useradd --create-home --uid 10001 app && mkdir /app && chown app:app /app
USER app
WORKDIR /app

# Dependencies first for layer caching.
COPY --chown=app:app pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY --chown=app:app brandlens_worker ./brandlens_worker
RUN uv sync --frozen --no-dev

# Bake the embedding model into the image so cold starts never download it (CLAUDE.md gotcha).
RUN python -c "from brandlens_worker.embeddings import Embedder; \
print(Embedder('BAAI/bge-small-en-v1.5', '/app/.models').embed(['warm-up']).shape)"

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/healthz', timeout=4)"

# Render (and most hosts) inject PORT.
CMD ["sh", "-c", "uvicorn --factory brandlens_worker.main:create_app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
