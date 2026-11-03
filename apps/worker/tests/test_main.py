from fastapi.testclient import TestClient

from brandlens_worker.main import create_app, warm_embedder
from brandlens_worker.settings import load_settings


def test_healthz_reports_env_and_provider_without_secrets(worker_env: dict[str, str]) -> None:
    client = TestClient(create_app(load_settings(_env_file=None), run_queue=False))
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "env": "test", "provider": "groq"}
    assert "do-not-leak" not in res.text


class _Embedder:
    def __init__(self, fail: bool = False) -> None:
        self.calls: list[list[str]] = []
        self.fail = fail

    def embed(self, texts: list[str]) -> None:
        self.calls.append(texts)
        if self.fail:
            raise OSError("model cache unavailable")


async def test_warm_embedder_loads_the_model_once_before_serving() -> None:
    embedder = _Embedder()
    await warm_embedder(embedder)
    assert embedder.calls == [["warm-up"]]


async def test_warm_embedder_never_raises() -> None:
    embedder = _Embedder(fail=True)
    await warm_embedder(embedder)  # logged; the model then loads on first use
    assert len(embedder.calls) == 1
