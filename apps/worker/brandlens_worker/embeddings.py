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

from brandlens_worker import config

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
        out = np.zeros((len(texts), DIM), dtype=np.float32)
        for batch in token_batches(texts):
            vecs = list(model.embed([texts[i] for i in batch], batch_size=len(batch)))
            out[batch] = np.stack(vecs)
        return normalise(out)


MAX_TOKENS = 512  # bge-small truncates here


def token_batches(texts: Sequence[str], budget: int = config.EMBED_TOKEN_BUDGET) -> list[list[int]]:
    """Indices grouped by similar length so that (batch size × longest text, in rough tokens)
    stays within `budget`. A batch pads to its longest text and ONNX Runtime keeps its peak arena,
    so one 512-token query batched with 24 sentences cost ~500 MB in the P12 benchmark; a long text
    now runs alone and short sentences still batch together."""
    order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
    batches: list[list[int]] = []
    cur: list[int] = []
    for i in order:
        tokens = min(MAX_TOKENS, len(texts[i]) // 4 + 2)  # ~4 characters per token
        if cur and (len(cur) + 1) * tokens > budget:
            batches.append(cur)
            cur = []
        cur.append(i)
    if cur:
        batches.append(cur)
    return batches


def cosine(a: npt.NDArray[Any], b: npt.NDArray[Any]) -> float:
    va, vb = normalise(a)[0], normalise(b)[0]
    return float(np.dot(va, vb))


def to_pgvector(vec: npt.NDArray[Any]) -> str:
    """Text literal accepted by `::vector` casts, e.g. '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.7f}" for x in np.asarray(vec, dtype=np.float32).ravel()) + "]"
