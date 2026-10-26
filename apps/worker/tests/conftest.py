import pytest

VALID_ENV: dict[str, str] = {
    "SUPABASE_URL": "http://127.0.0.1:54321",
    "SUPABASE_SECRET_KEY": "sb-secret-do-not-leak",
    "DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "PGMQ_QUEUE": "review_jobs",
    "LLM_PROVIDER": "groq",
    "LLM_FALLBACK_PROVIDER": "gemini",
    "GROQ_API_KEY": "gsk-do-not-leak",
    "GEMINI_API_KEY": "gem-do-not-leak",
    "GROQ_MODEL_TEXT": "text-model",
    "GROQ_MODEL_VISION": "vision-model",
    "GEMINI_MODEL_TEXT": "text-model",
    "GEMINI_MODEL_VISION": "vision-model",
    "EMBEDDING_MODEL": "BAAI/bge-small-en-v1.5",
    "MODEL_CACHE_DIR": "./.models",
    "OCR_ENGINE": "tesseract",
    "LANGFUSE_HOST": "https://us.cloud.langfuse.com",
    "LANGFUSE_PUBLIC_KEY": "pk-lf-test",
    "LANGFUSE_SECRET_KEY": "sk-lf-do-not-leak",
    "ENV": "test",
    "LOG_LEVEL": "info",
}


@pytest.fixture
def worker_env(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """A complete, fake worker environment. Tests never read the real `.env`."""
    for key, value in VALID_ENV.items():
        monkeypatch.setenv(key, value)
    return VALID_ENV
