"""The PayWise visual kit and fake retrieval for vision/PDF tests and evals (no pytest import, so
the evals also run inside the production worker image)."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np

from brandlens_worker.pipeline.image import VisualKit
from brandlens_worker.vision.colour import PaletteColour
from brandlens_worker.vision.logo import load_template
from tests.vault_fixture import ROOT, d

KIT_DIR = ROOT / "fixtures" / "paywise"
CREATIVES = KIT_DIR / "creatives"
LABELS: list[dict[str, Any]] = json.loads((CREATIVES / "labels.json").read_text())["creatives"]
INTENT = {"goal": "webinar sign-ups", "audience": "first-time investors", "cta": "Register now",
          "channel": "instagram_post"}  # fmt: skip
RETRIEVED = [
    {"id": "rule-VS-02", "code": "VS-02", "kind": "rule", "dimension": "visual", "similarity": 0.6},
    {"id": "rule-VS-03", "code": "VS-03", "kind": "rule", "dimension": "visual", "similarity": 0.5},
    {"id": "rule-A-02", "code": "A-02", "kind": "rule", "dimension": "access", "similarity": 0.55},
    {"id": "rule-CL-03", "code": "CL-03", "kind": "rule", "dimension": "claims", "similarity": 0.7},
]


@cache
def kit() -> VisualKit:
    logos = [
        load_template(a["name"], (KIT_DIR / "logos" / Path(a["storage_path"]).name).read_bytes())
        for a in d.ASSETS
        if a["kind"] == "logo"
    ]
    palette = [PaletteColour(c["name"], c["hex"]) for c in d.PALETTE]
    return VisualKit(logos=logos, palette=palette)


async def fake_embed(texts: list[str]) -> Any:
    return np.zeros((len(texts), 384), np.float32)


async def fake_match(_vec: Any) -> list[dict[str, Any]]:
    return [dict(r) for r in RETRIEVED]
