"""Local text embeddings: fastembed + BAAI/bge-small-en-v1.5 (384-d, ONNX, no torch).

The model downloads on first use into MODEL_CACHE_DIR; the Docker image bakes it in at build time.
"""

from __future__ import annotations

import threading
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

DIM = 384

Vector = npt.NDArray[np.float32]

_lock = threading.Lock()
_models: dict[tuple[str, str], Any] = {}


def get_model(model_name: str, cache_dir: Path | str) -> Any:
    """Lazy singleton per (model, cache dir). Imports fastembed only when first needed."""
    key = (model_name, str(cache_dir))
    with _lock:
        if key not in _models:
            from fastembed import TextEmbedding

            _models[key] = TextEmbedding(model_name=model_name, cache_dir=str(cache_dir))
        return _models[key]


def normalise(vectors: npt.NDArray[Any]) -> Vector:
    arr = np.asarray(vectors, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr[None, :]
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    out: Vector = (arr / norms).astype(np.float32)
    return out


class Embedder:
    def __init__(self, model_name: str, cache_dir: Path | str) -> None:
        self.model_name = model_name
        self.cache_dir = cache_dir

    def embed(self, texts: Sequence[str]) -> Vector:
        """Shape (len(texts), 384), each row L2-normalised."""
        if not texts:
            return np.zeros((0, DIM), dtype=np.float32)
        model = get_model(self.model_name, self.cache_dir)
        return normalise(np.stack(list(model.embed(list(texts)))))


def cosine(a: npt.NDArray[Any], b: npt.NDArray[Any]) -> float:
    va, vb = normalise(a)[0], normalise(b)[0]
    return float(np.dot(va, vb))


def to_pgvector(vec: npt.NDArray[Any]) -> str:
    """Text literal accepted by `::vector` casts, e.g. '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.7f}" for x in np.asarray(vec, dtype=np.float32).ravel()) + "]"
