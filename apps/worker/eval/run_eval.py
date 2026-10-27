"""Golden-set eval (SPEC §17) → eval/report.md + eval/report.json.

    make eval        (or: cd apps/worker && uv run python eval/run_eval.py)

Runs the full pipeline in-process (no queue, no DB) on every row of eval/golden/drafts.jsonl:
stages 1-4, the LLM pass, the citation gate and intent verification, exactly as the
`review_version` job does. The vault is the PayWise demo vault (scripts/demo_data.py, the source
`seed.sql` and `seed_demo.py` are built from) at a fixed date; retrieval embeds it with the real
bge-small model and mirrors `public.match_vault` (approved rules; facts that are org-wide or in
the draft's campaign and still valid; top-k by cosine).

LLM responses go through the committed response cache (eval/cache/, `LLM_CACHE` on). A cache miss
calls the configured provider with the keys in the environment and records the response, so CI
replays unchanged prompts for free and a changed prompt is evaluated live.

Exit code: 0 when every gate passes; 1 when a gate fails (SPEC §17):
- a dimension configured above "suggestion" has precision < PRECISION_GATE
- blocker recall < RECALL_TARGET
- any finding shown without a rule, fact or WCAG citation
- any row ran degraded (no LLM), which would measure the deterministic stages only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
import numpy.typing as npt

WORKER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKER))
sys.path.insert(0, str(WORKER.parents[1] / "scripts"))

import demo_data as d  # type: ignore[import-not-found]  # noqa: E402
from pydantic import SecretStr  # noqa: E402

from brandlens_worker import config  # noqa: E402
from brandlens_worker.embeddings import Embedder  # noqa: E402
from brandlens_worker.llm.base import DegradedError  # noqa: E402
from brandlens_worker.llm.cache import LLMCache  # noqa: E402
from brandlens_worker.llm.router import LLMRouter, build_router  # noqa: E402
from brandlens_worker.pipeline.quotes import find_quote  # noqa: E402
from brandlens_worker.pipeline.run import (  # noqa: E402
    LLMStageResult,
    StagesResult,
    VersionInput,
    run_stages_1_to_4,
    run_stages_5_6,
)
from brandlens_worker.pipeline.types import Doc, Finding, Vault  # noqa: E402
from brandlens_worker.vault import fact_embed_text, rule_embed_text  # noqa: E402
from tests.kit_fixture import KIT_DIR, kit  # noqa: E402
from tests.pdf_labels import matches as pdf_matches  # noqa: E402
from tests.vault_fixture import NOW, paywise_vault  # noqa: E402

EVAL = WORKER / "eval"
GOLDEN = EVAL / "golden" / "drafts.jsonl"
REWRITES = EVAL / "golden" / "rewrites.jsonl"
CACHE_DIR = EVAL / "cache"
CAMPAIGNS = {"diwali": d.DIWALI, "navratri": d.NAVRATRI}
DIMENSIONS = ("claims", "facts", "terms", "tone", "visual", "access")
RANK = {"suggestion": 0, "warning": 1, "blocker": 2}
OVERLAP = 0.5  # SPEC §17: quotes overlap by ≥ 50% (of the shorter span)
BENCH_RUNS = 30
DEGRADED_RETRIES = 2
DEGRADED_COOLDOWN_S = 65  # just over the providers' one-minute rate-limit window


# --------------------------------------------------------------------------- recording cache


class RecordingCache(LLMCache):
    """The response cache, counting hits and misses and the latency recorded with each hit (a hit
    replays in 0 ms; the benchmark reports the latency the call had when it was recorded)."""

    def __init__(self, directory: Path) -> None:
        super().__init__(directory, enabled=True)
        self.hits = 0
        self.misses = 0
        self.recorded_ms = 0
        self.used: set[str] = set()

    def get(self, key: str) -> dict[str, Any] | None:
        value = super().get(key)
        if value is not None:
            self.used.add(key)
            self.hits += 1
            self.recorded_ms += int(value.get("meta", {}).get("latency_ms") or 0)
        return value

    def put(self, key: str, value: dict[str, Any]) -> None:
        self.used.add(key)
        self.misses += 1
        super().put(key, value)

    def prune(self) -> int:
        """Delete entries this run didn't use (old prompt versions, removed rows)."""
        stale = [p for p in self.directory.glob("*.json") if p.stem not in self.used]
        for path in stale:
            path.unlink()
        return len(stale)


def make_router(cache: LLMCache) -> LLMRouter:
    """The production router (same providers, models and order) from the environment."""
    env = os.environ.get
    settings = SimpleNamespace(
        llm_provider=env("LLM_PROVIDER", "groq"),
        llm_fallback_provider=env("LLM_FALLBACK_PROVIDER", "gemini"),
        groq_api_key=SecretStr(env("GROQ_API_KEY", "")),
        groq_model_text=env("GROQ_MODEL_TEXT", ""),
        groq_model_vision=env("GROQ_MODEL_VISION", ""),
        gemini_api_key=SecretStr(env("GEMINI_API_KEY", "")),
        gemini_model_text=env("GEMINI_MODEL_TEXT", ""),
        gemini_model_vision=env("GEMINI_MODEL_VISION", ""),
    )
    missing = [
        name
        for name in ("GROQ_MODEL_TEXT", "GROQ_MODEL_VISION", "GEMINI_MODEL_TEXT")
        if not env(name)
    ]
    if missing:
        raise SystemExit(f"eval: set {', '.join(missing)} (model IDs are part of the cache key)")
    return build_router(settings, cache=cache)


# --------------------------------------------------------------------------- retrieval


class VaultIndex:
    """bge-small embeddings of the PayWise vault and an in-memory `match_vault`."""

    def __init__(self, embedder: Embedder) -> None:
        self.embedder = embedder
        rules = [
            {
                "id": f"rule-{c['code']}",
                "code": c["code"],
                "kind": "rule",
                "dimension": c["dimension"],
                "text": rule_embed_text(c),
            }
            for c in d.RULE_CARDS
        ]
        facts = [
            {
                "id": f"fact-{f['code']}",
                "code": f["code"],
                "kind": "fact",
                "dimension": "facts",
                "campaign_id": f["campaign_id"],
                "valid_until": f["valid_until"],
                "text": fact_embed_text(f),
            }
            for f in d.FACTS
        ]
        self.rules, self.facts = rules, facts
        vecs = embedder.embed([r["text"] for r in rules + facts])
        self.rule_vecs = vecs[: len(rules)]
        self.fact_vecs = vecs[len(rules) :]

    def match(
        self, vec: npt.NDArray[np.float32], campaign_id: str, now: datetime, k: int
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        sims = self.rule_vecs @ vec
        for i in np.argsort(-sims)[:k]:
            r = self.rules[i]
            out.append({**_public(r), "similarity": float(sims[i])})
        sims = self.fact_vecs @ vec
        scoped = [
            i
            for i, f in enumerate(self.facts)
            if (f["campaign_id"] in (None, campaign_id))
            and (f["valid_until"] is None or datetime.fromisoformat(f["valid_until"]) > now)
        ]
        for i in sorted(scoped, key=lambda i: -sims[i])[:k]:
            out.append({**_public(self.facts[i]), "similarity": float(sims[i])})
        return sorted(out, key=lambda r: -r["similarity"])[:k]


def _public(item: dict[str, Any]) -> dict[str, Any]:
    return {key: item[key] for key in ("id", "code", "kind", "dimension")}


# --------------------------------------------------------------------------- matching


def label_span(doc: Doc, label: dict[str, Any], taken: list[tuple[int, int]]) -> tuple[int, int]:
    span = find_quote(doc.text, label["quote"], taken)
    if span is None:
        raise SystemExit(f"eval: label quote not in its draft: {label['quote']!r}")
    return span


def overlap(a: tuple[int, int], b: tuple[int, int]) -> float:
    inter = max(0, min(a[1], b[1]) - max(a[0], b[0]))
    shorter = min(a[1] - a[0], b[1] - b[0]) or 1
    return inter / shorter


def cites(f: Finding, label: dict[str, Any]) -> bool:
    code: str | None = label.get("code")
    if code and code.startswith("WCAG "):
        return f.wcag_ref == code.removeprefix("WCAG ")
    if code and code not in f.codes:
        return False
    return "wcag" not in label or f.wcag_ref == label["wcag"]


def text_match(f: Finding, label: dict[str, Any], span: tuple[int, int]) -> bool:
    if f.target != "text" or f.dimension != label["dimension"] or not cites(f, label):
        return False
    return overlap((f.start, f.end), span) >= OVERLAP


def image_match(f: Finding, label: dict[str, Any]) -> bool:
    return f.dimension == label["dimension"] and cites(f, label)


# --------------------------------------------------------------------------- running


@dataclass
class RowResult:
    row: dict[str, Any]
    findings: list[Finding]
    labels_hit: list[bool]
    preds_tp: list[bool]
    timings: dict[str, int]
    drops: dict[str, int]
    rewrite_failures: dict[str, int]
    degraded: bool
    provider: str | None
    model: str | None
    prompt_version: str | None
    words: int
    llm_ms: int = 0
    extra: list[str] = field(default_factory=list)


async def run_row(
    row: dict[str, Any], index: VaultIndex, embedder: Embedder, router: Any, cache: RecordingCache
) -> RowResult:
    campaign = CAMPAIGNS[row["campaign"]]
    vault: Vault = paywise_vault(campaign, NOW)
    if "text" in row:
        version = VersionInput(format="text", body=row["text"], intent=row["intent"])
    else:
        data = (KIT_DIR / row["file"]).read_bytes()
        fmt = "pdf" if row["file"].endswith(".pdf") else "image"
        version = VersionInput(format=fmt, data=data, intent=row["intent"], kit=kit())

    async def embed(texts: list[str]) -> npt.NDArray[np.float32]:
        return await asyncio.to_thread(embedder.embed, texts)

    async def match_vault(vec: npt.NDArray[np.float32]) -> list[dict[str, Any]]:
        return index.match(vec, campaign, NOW, config.TOPK)

    stages: StagesResult = await run_stages_1_to_4(
        version, vault, embed=embed, match_vault=match_vault, topk=config.TOPK
    )
    recorded_before = cache.recorded_ms
    llm: LLMStageResult | None = None
    # Free-tier quotas (per-minute token limits on both providers) can exhaust the retries and the
    # fallback mid-run. That measures quota, not the pipeline: cool down and retry the row. A row
    # still degraded after the retries is reported and fails the gate.
    for attempt in range(DEGRADED_RETRIES + 1):
        try:
            llm = await run_stages_5_6(
                stages, vault, row["intent"], router=router, embed_sync=embedder.embed
            )
            break
        except DegradedError as exc:
            if attempt == DEGRADED_RETRIES:
                break
            print(f"  {row['id']}: degraded ({exc}); retrying in {DEGRADED_COOLDOWN_S} s")
            await asyncio.sleep(DEGRADED_COOLDOWN_S)
    timings = dict(stages.timings)
    if llm:
        timings.update({k: v for k, v in llm.timings.items() if k in ("llm", "gate")})
    llm_ms = timings.get("llm", 0) + (cache.recorded_ms - recorded_before)
    timings["llm"] = llm_ms

    findings = stages.findings + (llm.findings if llm else [])
    labels = row["labels"]
    doc = stages.doc
    if "text" in row:
        # Repeated quotes resolve to successive occurrences within a dimension; labels in different
        # dimensions may share a quote (one sentence can be both jargon-heavy and off-voice).
        taken: dict[str, list[tuple[int, int]]] = {}
        spans = []
        for lab in labels:
            claimed = taken.setdefault(lab["dimension"], [])
            span = label_span(doc, lab, claimed)
            claimed.append(span)
            spans.append(span)
        hit = [
            any(text_match(f, lab, s) for f in findings)
            for lab, s in zip(labels, spans, strict=True)
        ]
        tp = [
            any(text_match(f, lab, s) for lab, s in zip(labels, spans, strict=True))
            for f in findings
        ]
    elif version.format == "pdf":
        hit = [any(pdf_matches(f, doc, lab) for f in findings) for lab in labels]
        tp = [any(pdf_matches(f, doc, lab) for lab in labels) for f in findings]
    else:
        hit = [any(image_match(f, lab) for f in findings) for lab in labels]
        tp = [any(image_match(f, lab) for lab in labels) for f in findings]

    return RowResult(
        row=row,
        findings=findings,
        labels_hit=hit,
        preds_tp=tp,
        timings=timings,
        drops=llm.drops if llm else {},
        rewrite_failures=llm.rewrite_failures if llm else {},
        degraded=llm is None,
        provider=llm.provider if llm else None,
        model=llm.model_version if llm else None,
        prompt_version=llm.prompt_version if llm else None,
        words=doc.word_count,
        llm_ms=llm_ms,
    )


# --------------------------------------------------------------------------- metrics


def prf(tp: int, n_pred: int, hit: int, n_label: int) -> dict[str, float | None]:
    p = tp / n_pred if n_pred else None
    r = hit / n_label if n_label else None
    f1 = 2 * p * r / (p + r) if p is not None and r is not None and (p + r) else None
    return {"precision": p, "recall": r, "f1": f1}


def metrics(results: list[RowResult]) -> dict[str, Any]:
    per: dict[str, dict[str, Any]] = {}
    for dim in DIMENSIONS:
        preds = [
            (f, t)
            for r in results
            for f, t in zip(r.findings, r.preds_tp, strict=True)
            if f.dimension == dim
        ]
        labs = [
            (lab, h)
            for r in results
            for lab, h in zip(r.row["labels"], r.labels_hit, strict=True)
            if lab["dimension"] == dim
        ]
        tp = sum(t for _, t in preds)
        hit = sum(h for _, h in labs)
        by_source = Counter(f.source for f, _ in preds)
        fp_source = Counter(f.source for f, t in preds if not t)
        per[dim] = {
            **prf(tp, len(preds), hit, len(labs)),
            "predicted": len(preds),
            "tp": tp,
            "labels": len(labs),
            "labels_found": hit,
            "max_severity": config.DIMENSION_MAX_SEVERITY[dim],  # type: ignore[index]
            "by_source": dict(by_source),
            "fp_by_source": dict(fp_source),
        }
    blockers = [
        (lab, h)
        for r in results
        for lab, h in zip(r.row["labels"], r.labels_hit, strict=True)
        if lab["severity"] == "blocker"
    ]
    all_preds = sum(len(r.findings) for r in results)
    all_tp = sum(sum(r.preds_tp) for r in results)
    all_labels = sum(len(r.row["labels"]) for r in results)
    all_hit = sum(sum(r.labels_hit) for r in results)
    clean = [r for r in results if r.row["clean"]]
    return {
        "dimensions": per,
        "overall": {
            **prf(all_tp, all_preds, all_hit, all_labels),
            "predicted": all_preds,
            "labels": all_labels,
        },
        "blocker_recall": (sum(h for _, h in blockers) / len(blockers)) if blockers else None,
        "blocker_labels": len(blockers),
        "uncited_shown": sum(1 for r in results for f in r.findings if not f.cited),
        "clean_rows": len(clean),
        "clean_rows_with_findings": sum(1 for r in clean if r.findings),
        "clean_false_positives": sum(len(r.findings) for r in clean),
        "degraded_rows": [r.row["id"] for r in results if r.degraded],
        "gate_drops": dict(sum((Counter(r.drops) for r in results), Counter())),
        "rewrite_failures": dict(sum((Counter(r.rewrite_failures) for r in results), Counter())),
    }


def gates(m: dict[str, Any]) -> list[str]:
    failed = []
    for dim, row in m["dimensions"].items():
        p = row["precision"]
        above_suggestion = RANK[row["max_severity"]] > RANK["suggestion"]
        if above_suggestion and p is not None and p < config.PRECISION_GATE:
            failed.append(
                f"{dim} precision {p:.2f} < {config.PRECISION_GATE} while configured as "
                f"{row['max_severity']} (set DIMENSION_MAX_SEVERITY['{dim}'] = 'suggestion')"
            )
    br = m["blocker_recall"]
    if br is not None and br < config.RECALL_TARGET:
        failed.append(f"blocker recall {br:.2f} < {config.RECALL_TARGET}")
    if m["uncited_shown"]:
        failed.append(f"{m['uncited_shown']} uncited finding(s) shown")
    if m["degraded_rows"]:
        failed.append(f"{len(m['degraded_rows'])} row(s) ran degraded (no LLM)")
    return failed


def pct(values: list[int], q: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))]


def calibrate(embedder: Embedder) -> dict[str, Any]:
    """Cosine of original vs rewritten sentence (the §9 step 1 check) on labelled pairs."""
    pairs = [json.loads(line) for line in REWRITES.read_text().splitlines() if line.strip()]
    vecs = embedder.embed([t for p in pairs for t in (p["original"], p["rewrite"])])
    cos = [float(vecs[2 * i] @ vecs[2 * i + 1]) for i in range(len(pairs))]
    good = [c for c, p in zip(cos, pairs, strict=True) if p["good"]]
    bad = [c for c, p in zip(cos, pairs, strict=True) if not p["good"]]
    table = []
    for t in (0.70, 0.72, 0.74, 0.76, 0.78, 0.80, 0.82, 0.84, 0.86, 0.88, 0.90):
        kept_good = sum(c >= t for c in good)
        kept_bad = sum(c >= t for c in bad)
        table.append(
            {
                "threshold": t,
                "good_kept": kept_good,
                "bad_kept": kept_bad,
                "tpr": kept_good / len(good),
                "fpr": kept_bad / len(bad),
            }
        )
    return {
        "good": len(good),
        "bad": len(bad),
        "table": table,
        "good_min": min(good),
        "bad_max": max(bad),
        "pairs": [
            {"id": p["id"], "good": p["good"], "cosine": round(c, 3)}
            for p, c in zip(pairs, cos, strict=True)
        ],
    }


# --------------------------------------------------------------------------- report


def fmt(v: float | None) -> str:
    return "n/a" if v is None else f"{v:.2f}"


def report(
    results: list[RowResult],
    m: dict[str, Any],
    failed: list[str],
    cal: dict[str, Any],
    bench: dict[str, Any],
    cache: RecordingCache,
) -> str:
    versions = Counter((r.provider, r.model, r.prompt_version) for r in results if not r.degraded)
    lines = [
        "# Golden-set eval (P14)",
        "",
        "Generated by `make eval` (`apps/worker/eval/run_eval.py`) from "
        f"`eval/golden/drafts.jsonl` ({len(results)} rows: "
        f"{sum('text' in r.row for r in results)} text, "
        f"{sum(r.row.get('file', '').endswith('.png') for r in results)} images, "
        f"{sum(r.row.get('file', '').endswith('.pdf') for r in results)} PDF; "
        f"{m['clean_rows']} clean). Full pipeline in-process: deterministic filters, retrieval "
        "(real bge-small), one LLM call per draft (per page chunk for PDFs), citation gate, "
        "intent verification. LLM responses replay from the committed cache "
        f"(`eval/cache/`): {cache.hits} hits, {cache.misses} live calls this run.",
        "",
        f"**Result: {'PASS' if not failed else 'FAIL'}**",
        "",
    ]
    lines += [f"- ❌ {f}" for f in failed] or ["- ✅ all gates pass"]
    lines += [
        "",
        "## Gates",
        "",
        "| Gate | Value | Target |",
        "|---|---|---|",
        f"| Blocker recall | {fmt(m['blocker_recall'])} ({m['blocker_labels']} blocker labels) "
        f"| ≥ {config.RECALL_TARGET} |",
        f"| Uncited findings shown | {m['uncited_shown']} | 0 |",
        f"| Overall precision / recall | {fmt(m['overall']['precision'])} / "
        f"{fmt(m['overall']['recall'])} | |",
        f"| Clean drafts with any finding | {m['clean_rows_with_findings']} of {m['clean_rows']} "
        f"({m['clean_false_positives']} findings) | |",
        f"| Degraded rows | {len(m['degraded_rows'])} | 0 |",
        "",
        "## Per dimension",
        "",
        "Precision is over every finding shown in the dimension (deterministic and LLM); recall "
        "is over labels. A prediction is a true positive when its dimension matches, it cites a "
        "label's code and its span overlaps the label's quote by ≥ 50% of the shorter one "
        "(images: same code; PDF: same page and ≥ 50% box overlap).",
        "",
        "| Dimension | Precision | Recall | F1 | Shown (TP) | Labels (found) | Max severity | "
        "FPs by source |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for dim, row in m["dimensions"].items():
        gated = (
            " ⚠️"
            if row["precision"] is not None and row["precision"] < config.PRECISION_GATE
            else ""
        )
        fps = ", ".join(f"{k} {v}" for k, v in sorted(row["fp_by_source"].items())) or "none"
        lines.append(
            f"| {dim} | {fmt(row['precision'])}{gated} | {fmt(row['recall'])} | {fmt(row['f1'])} "
            f"| {row['predicted']} ({row['tp']}) | {row['labels']} ({row['labels_found']}) "
            f"| {row['max_severity']} | {fps} |"
        )
    lines += [
        "",
        "## Misses and false positives",
        "",
        "| Row | Kind | Dimension | Codes | Quote |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        for lab, h in zip(r.row["labels"], r.labels_hit, strict=True):
            if not h:
                what = lab.get("quote") or lab.get("check") or ""
                lines.append(
                    f"| {r.row['id']} | missed | {lab['dimension']} | {lab.get('code') or ''} "
                    f"| {_cell(what)} |"
                )
        for f, t in zip(r.findings, r.preds_tp, strict=True):
            if not t:
                quote = f.quote if f.quote is not None else _slice(r, f)
                lines.append(
                    f"| {r.row['id']} | FP ({f.source}) | {f.dimension} | {', '.join(f.codes)} "
                    f"| {_cell(quote)} |"
                )
    lines += [
        "",
        "## Citation gate drops (LLM findings removed before display)",
        "",
        "| Reason | Count |",
        "|---|---|",
        *[f"| {k} | {v} |" for k, v in sorted(m["gate_drops"].items())],
        "",
        "Rewrites nulled by intent verification: "
        + (", ".join(f"{k} {v}" for k, v in sorted(m["rewrite_failures"].items())) or "none"),
        "",
        "## Intent verification threshold (`INTENT_COSINE`)",
        "",
        f"Cosine between the original and the rewritten sentence (SPEC §9 step 1) on "
        f"{cal['good']} good rewrites (issue fixed, meaning kept) and {cal['bad']} bad ones "
        "(meaning drifted; 8 of them stay on the same topic). `eval/golden/rewrites.jsonl`. "
        f"Lowest good: {cal['good_min']:.3f}; highest bad: {cal['bad_max']:.3f}. Configured: "
        f"**{config.INTENT_COSINE}**.",
        "",
        "| Threshold | Good kept (TPR) | Bad kept (FPR) |",
        "|---|---|---|",
        *[
            f"| {t['threshold']:.2f}{' ←' if t['threshold'] == config.INTENT_COSINE else ''} "
            f"| {t['good_kept']}/{cal['good']} ({t['tpr']:.2f}) "
            f"| {t['bad_kept']}/{cal['bad']} ({t['fpr']:.2f}) |"
            for t in cal["table"]
        ],
        "",
        "## Latency",
        "",
        f"{bench['runs']} text drafts (≤ {config.MAX_WORDS} words), each through the full "
        "pipeline. "
        "Stages are measured in this process; the LLM stage is the latency the provider call had "
        "when it was recorded (a cache replay takes 0 ms). Target P95 ≤ "
        f"{config.P95_TARGET_S} s.",
        "",
        "| Stage | P50 ms | P95 ms |",
        "|---|---|---|",
        *[f"| {k} | {v['p50']} | {v['p95']} |" for k, v in bench["stages"].items()],
        f"| **total** | **{bench['total']['p50']}** | **{bench['total']['p95']}** |",
        "",
        "## Versions",
        "",
        "| Provider | Model | Prompt | Rows |",
        "|---|---|---|---|",
        *[f"| {p} | {mo} | {pv} | {n} |" for (p, mo, pv), n in sorted(versions.items(), key=str)],
        "",
        f"Thresholds: PRECISION_GATE {config.PRECISION_GATE}, RECALL_TARGET "
        f"{config.RECALL_TARGET}, TOPK {config.TOPK}, INTENT_COSINE {config.INTENT_COSINE}. "
        f"Vault date fixed at {NOW.isoformat()}.",
        "",
    ]
    return "\n".join(lines)


def _cell(s: str) -> str:
    s = " ".join(str(s).split())
    return (s[:80] + "…" if len(s) > 80 else s).replace("|", "\\|")


def _slice(r: RowResult, f: Finding) -> str:
    text = r.row.get("text")
    return text[f.start : f.end] if isinstance(text, str) else ""


# --------------------------------------------------------------------------- main


async def run(
    rows: list[dict[str, Any]], embedder: Embedder, router: Any, cache: RecordingCache
) -> list[RowResult]:
    index = VaultIndex(embedder)
    out = []
    for row in rows:
        t = time.perf_counter()
        res = await run_row(row, index, embedder, router, cache)
        res.timings["wall"] = round((time.perf_counter() - t) * 1000)
        mark = "degraded" if res.degraded else f"{sum(res.labels_hit)}/{len(res.labels_hit)} labels"
        print(f"  {row['id']:<22} {len(res.findings):>2} findings, {mark}", flush=True)
        out.append(res)
    return out


def bench(results: list[RowResult]) -> dict[str, Any]:
    text = [r for r in results if "text" in r.row and r.words <= config.MAX_WORDS][:BENCH_RUNS]
    stages = ("ingest", "protect", "filters", "retrieve", "llm", "gate")
    per = {s: [r.timings.get(s, 0) for r in text] for s in stages}
    totals = [sum(r.timings.get(s, 0) for s in stages) for r in text]
    return {
        "runs": len(text),
        "stages": {s: {"p50": pct(v, 0.5), "p95": pct(v, 0.95)} for s, v in per.items()},
        "total": {
            "p50": pct(totals, 0.5),
            "p95": pct(totals, 0.95),
            "mean": round(statistics.mean(totals)) if totals else 0,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--golden", type=Path, default=GOLDEN)
    parser.add_argument("--only", nargs="*", help="row ids to run (report still written)")
    parser.add_argument("--out", type=Path, default=EVAL / "report.md")
    parser.add_argument("--cache-dir", type=Path, default=CACHE_DIR)
    parser.add_argument(
        "--prune", action="store_true", help="delete cache entries this (full) run didn't use"
    )
    args = parser.parse_args()
    if args.prune and args.only:
        parser.error("--prune needs a full run")

    rows = [json.loads(line) for line in args.golden.read_text().splitlines() if line.strip()]
    if args.only:
        rows = [r for r in rows if r["id"] in set(args.only)]
    cache = RecordingCache(args.cache_dir)
    router = make_router(cache)
    embedder = Embedder(
        os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
        os.environ.get("MODEL_CACHE_DIR", str(WORKER / ".models")),
    )
    embedder.embed(["warm-up"])

    print(f"eval: {len(rows)} rows")
    results = asyncio.run(run(rows, embedder, router, cache))
    m = metrics(results)
    failed = gates(m)
    cal = calibrate(embedder)
    b = bench(results)

    args.out.write_text(report(results, m, failed, cal, b, cache))
    payload = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "passed": not failed,
        "failed": failed,
        "metrics": m,
        "intent_cosine": cal,
        "latency": b,
        "cache": {"hits": cache.hits, "live_calls": cache.misses},
        "rows": [
            {
                "id": r.row["id"],
                "labels_found": r.labels_hit,
                "findings": [
                    {
                        "dimension": f.dimension,
                        "codes": f.codes,
                        "severity": f.severity,
                        "source": f.source,
                        "tp": t,
                        "cited": f.cited,
                        "quote": f.quote if f.quote is not None else _slice(r, f),
                    }
                    for f, t in zip(r.findings, r.preds_tp, strict=True)
                ],
            }
            for r in results
        ],
    }
    out_json = args.out.with_suffix(".json")
    out_json.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"eval: wrote {args.out}")
    if args.prune:
        print(f"eval: pruned {cache.prune()} unused cache entries")
    for dim, row in m["dimensions"].items():
        p, r = fmt(row["precision"]), fmt(row["recall"])
        print(f"  {dim:<7} P {p}  R {r}  ({row['max_severity']})")
    print(f"  blocker recall {fmt(m['blocker_recall'])}; uncited shown {m['uncited_shown']}")
    print("eval: PASS" if not failed else "eval: FAIL\n  - " + "\n  - ".join(failed))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
