from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
import pytest

from brandlens_worker.embeddings import DIM, Embedder, cosine, normalise, to_pgvector
from brandlens_worker.prompts import PromptError, load_prompt, parse_prompt
from brandlens_worker.tracing import Tracer


def test_load_prompt_returns_text_and_version() -> None:
    text, version = load_prompt("smoke")
    assert version == "smoke@1"
    assert "<draft>" in text
    assert not text.startswith("PROMPT_VERSION")


def test_load_prompt_picks_latest_and_checks_header(tmp_path: Path) -> None:
    (tmp_path / "review_v1.md").write_text("PROMPT_VERSION: review@1\none")
    (tmp_path / "review_v2.md").write_text("PROMPT_VERSION: review@2\ntwo")
    assert load_prompt("review", tmp_path) == ("two", "review@2")
    assert load_prompt("review_v1", tmp_path) == ("one", "review@1")
    (tmp_path / "bad_v1.md").write_text("PROMPT_VERSION: bad@9\nx")
    with pytest.raises(PromptError):
        load_prompt("bad", tmp_path)


def test_parse_prompt_requires_header() -> None:
    with pytest.raises(PromptError):
        parse_prompt("no header here")


def test_disabled_tracer_is_a_noop() -> None:
    tracer = Tracer(None)
    with tracer.trace_run("run-1") as span:
        span.update(output="x")
        tracer.generation("g", prompt_version="p@1", model="m", input_meta={}, output={})
    assert tracer.current_trace_id() is None
    tracer.flush()
    tracer.shutdown()


def test_tracer_swallows_client_errors() -> None:
    class Broken:
        def start_as_current_observation(self, **_: Any) -> Any:
            raise ConnectionError("langfuse down")

        def start_observation(self, **_: Any) -> Any:
            raise ConnectionError("langfuse down")

        def get_current_trace_id(self) -> str:
            raise ConnectionError("langfuse down")

        def flush(self) -> None:
            raise ConnectionError("langfuse down")

        def shutdown(self) -> None:
            raise ConnectionError("langfuse down")

    tracer = Tracer(Broken())
    with tracer.trace_run("run-1"):
        tracer.generation("g", prompt_version="p@1", model="m", input_meta={"words": 3}, output={})
    assert tracer.current_trace_id() is None
    tracer.flush()
    tracer.shutdown()


def test_tracer_from_settings_disabled() -> None:
    assert Tracer.from_settings(SimpleNamespace(), enabled=False).enabled is False


def test_normalise_and_cosine() -> None:
    v = normalise(np.array([[3.0, 4.0], [0.0, 0.0]]))
    assert np.allclose(v[0], [0.6, 0.8])
    assert np.allclose(v[1], [0.0, 0.0])  # zero vectors stay zero, no NaN
    assert cosine(np.array([1.0, 0.0]), np.array([2.0, 0.0])) == pytest.approx(1.0)
    assert cosine(np.array([1.0, 0.0]), np.array([0.0, 1.0])) == pytest.approx(0.0)


def test_to_pgvector_literal() -> None:
    assert to_pgvector(np.array([0.5, -0.25])) == "[0.5000000,-0.2500000]"


def _model_downloaded(cache: Path) -> bool:
    return cache.exists() and any(cache.rglob("*.onnx"))


MODEL_CACHE = Path(__file__).resolve().parents[1] / ".models"


@pytest.mark.skipif(
    not _model_downloaded(MODEL_CACHE), reason="bge-small not downloaded (run `make models`)"
)
def test_embeddings_shape_and_normalisation() -> None:
    emb = Embedder("BAAI/bge-small-en-v1.5", MODEL_CACHE)
    vecs = emb.embed(
        ["No guaranteed returns on mutual funds.", "Assured returns of 14.2%!", "Diwali webinar"]
    )
    assert vecs.shape == (3, DIM)
    assert np.allclose(np.linalg.norm(vecs, axis=1), 1.0, atol=1e-5)
    # the two returns sentences are closer to each other than to the webinar
    assert cosine(vecs[0], vecs[1]) > cosine(vecs[0], vecs[2])
    assert emb.embed([]).shape == (0, DIM)
