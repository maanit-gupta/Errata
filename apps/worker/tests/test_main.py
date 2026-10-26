from fastapi.testclient import TestClient

from brandlens_worker.main import create_app
from brandlens_worker.settings import load_settings


def test_healthz_reports_env_and_provider_without_secrets(worker_env: dict[str, str]) -> None:
    client = TestClient(create_app(load_settings(_env_file=None), run_queue=False))
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "env": "test", "provider": "groq"}
    assert "do-not-leak" not in res.text
