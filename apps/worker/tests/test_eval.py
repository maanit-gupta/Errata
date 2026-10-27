"""The golden-set eval's matching and gates (SPEC §17). No model, no LLM."""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from brandlens_worker.pipeline.types import Finding


def _load() -> ModuleType:
    path = Path(__file__).resolve().parents[1] / "eval" / "run_eval.py"
    spec = importlib.util.spec_from_file_location("run_eval", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["run_eval"] = module
    spec.loader.exec_module(module)
    return module


ev = _load()


def finding(dim: str, start: int, end: int, *codes: str, wcag: str | None = None) -> Finding:
    return Finding(
        dimension=dim,  # type: ignore[arg-type]
        start=start,
        end=end,
        severity="warning",
        explanation="",
        rule_id="r" if codes else None,
        wcag_ref=wcag,
        codes=list(codes),
    )


def test_overlap_is_relative_to_the_shorter_span() -> None:
    assert ev.overlap((0, 10), (2, 4)) == 1.0
    assert ev.overlap((0, 10), (8, 12)) == 0.5  # 2 of the shorter span's 4 chars
    assert ev.overlap((0, 4), (3, 10)) == 0.25
    assert ev.overlap((0, 4), (5, 9)) == 0.0


def test_text_match_needs_dimension_code_and_overlap() -> None:
    label = {"dimension": "claims", "code": "CL-03", "quote": "assured"}
    assert ev.text_match(finding("claims", 10, 17, "CL-03"), label, (10, 17))
    assert ev.text_match(finding("claims", 10, 17, "F-112", "CL-03"), label, (10, 17))
    assert not ev.text_match(finding("tone", 10, 17, "CL-03"), label, (10, 17))
    assert not ev.text_match(finding("claims", 10, 17, "TV-02"), label, (10, 17))
    assert not ev.text_match(finding("claims", 30, 37, "CL-03"), label, (10, 17))


def test_wcag_labels_match_the_wcag_reference() -> None:
    label = {"dimension": "access", "code": "WCAG 2.4.4", "quote": "Click here"}
    assert ev.text_match(finding("access", 0, 10, "WCAG 2.4.4", wcag="2.4.4"), label, (0, 10))
    assert not ev.text_match(finding("access", 0, 10, wcag="1.4.3"), label, (0, 10))


def metrics(precision: float | None, severity: str, **extra: Any) -> dict[str, Any]:
    dims = {
        d: {"precision": 1.0, "max_severity": "warning"}
        for d in ("claims", "facts", "terms", "tone", "visual", "access")
    }
    dims["tone"] = {"precision": precision, "max_severity": severity}
    return {
        "dimensions": dims,
        "blocker_recall": 1.0,
        "uncited_shown": 0,
        "degraded_rows": [],
        **extra,
    }


def test_precision_gate_only_applies_above_suggestion() -> None:
    assert (
        ev.gates(metrics(0.6, "warning"))
        and "tone precision" in ev.gates(metrics(0.6, "warning"))[0]
    )
    assert ev.gates(metrics(0.6, "suggestion")) == []
    assert ev.gates(metrics(0.9, "warning")) == []
    assert ev.gates(metrics(None, "warning")) == []  # nothing shown, nothing to gate


def test_recall_uncited_and_degraded_fail_the_gate() -> None:
    assert ev.gates(metrics(0.9, "warning", blocker_recall=0.7))
    assert ev.gates(metrics(0.9, "warning", uncited_shown=1))
    assert ev.gates(metrics(0.9, "warning", degraded_rows=["img-10"]))


def test_percentiles() -> None:
    values = list(range(1, 101))
    assert ev.pct(values, 0.5) == 51
    assert ev.pct(values, 0.95) == 95
    assert ev.pct([], 0.5) == 0
