"""Environment settings. Names match CLAUDE.md and `.env.example`.

Validated once at startup; a missing or malformed variable raises `SettingsError`, which names
the variable and never includes its value. Tunable thresholds live in `config.py`, not here.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import SecretStr, StringConstraints, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Provider = Literal["groq", "gemini"]


class SettingsError(RuntimeError):
    pass


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # Supabase
    supabase_url: NonEmptyStr
    supabase_secret_key: SecretStr
    database_url: SecretStr  # session pooler URI in cloud (port 5432)
    pgmq_queue: NonEmptyStr

    # LLM providers (model IDs always come from env; never hardcode them)
    llm_provider: Provider
    llm_fallback_provider: Provider | Literal["none"]
    groq_api_key: SecretStr
    gemini_api_key: SecretStr
    groq_model_text: NonEmptyStr
    groq_model_vision: NonEmptyStr
    gemini_model_text: NonEmptyStr
    gemini_model_vision: NonEmptyStr

    # Local models
    embedding_model: NonEmptyStr
    model_cache_dir: Path
    ocr_engine: Literal["paddle", "tesseract"]

    # Tracing
    langfuse_host: NonEmptyStr
    langfuse_public_key: SecretStr
    langfuse_secret_key: SecretStr

    # Notifications (optional): "needs review" messages for worker-made transitions (SPEC §15)
    discord_webhook_url: SecretStr | None = None
    site_url: str | None = None

    # Runtime
    env: NonEmptyStr
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    @field_validator(
        "supabase_secret_key",
        "database_url",
        "groq_api_key",
        "gemini_api_key",
        "langfuse_public_key",
        "langfuse_secret_key",
    )
    @classmethod
    def _secret_not_blank(cls, v: SecretStr) -> SecretStr:
        if not v.get_secret_value().strip():
            raise ValueError("is required")
        return v

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper_log_level(cls, v: object) -> object:
        return v.upper() if isinstance(v, str) else v

    @field_validator("supabase_url", "langfuse_host")
    @classmethod
    def _http_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("must be an http(s) URL")
        return v.rstrip("/")


def _format(exc: ValidationError) -> str:
    lines = []
    for err in exc.errors(include_input=False, include_url=False):
        name = str(err["loc"][0]).upper() if err["loc"] else "(root)"
        blank = err["type"] in {"missing", "string_too_short"}
        msg = "is required" if blank else err["msg"].removeprefix("Value error, ")
        lines.append(f"  - {name}: {msg}")
    return "Invalid worker environment (see apps/worker/.env.example):\n" + "\n".join(lines)


def load_settings(**overrides: object) -> Settings:
    """Build settings, converting validation errors into a value-free `SettingsError`."""
    try:
        return Settings(**overrides)  # type: ignore[arg-type]
    except ValidationError as exc:
        raise SettingsError(_format(exc)) from None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
