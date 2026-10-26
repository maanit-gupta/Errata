import pytest

from brandlens_worker.settings import SettingsError, load_settings


def test_valid_env_loads(worker_env: dict[str, str]) -> None:
    s = load_settings(_env_file=None)
    assert s.llm_provider == "groq"
    assert s.log_level == "INFO"
    assert s.groq_api_key.get_secret_value() == worker_env["GROQ_API_KEY"]


@pytest.mark.parametrize("name", ["GROQ_API_KEY", "DATABASE_URL", "PGMQ_QUEUE", "SUPABASE_URL"])
def test_missing_var_is_named(
    worker_env: dict[str, str], monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    monkeypatch.delenv(name)
    with pytest.raises(SettingsError, match=rf"{name}: is required"):
        load_settings(_env_file=None)


def test_blank_var_counts_as_missing(
    worker_env: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "  ")
    with pytest.raises(SettingsError, match="LANGFUSE_SECRET_KEY: is required"):
        load_settings(_env_file=None)


def test_errors_never_include_values(
    worker_env: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gsk-do-not-leak")
    monkeypatch.setenv("SUPABASE_URL", "sb-secret-do-not-leak")
    with pytest.raises(SettingsError) as exc:
        load_settings(_env_file=None)
    assert "LLM_PROVIDER" in str(exc.value)
    assert "do-not-leak" not in str(exc.value)
