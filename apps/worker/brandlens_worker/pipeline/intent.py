"""Intent verification of rewrites (SPEC §9). All local; target < 15 ms per rewrite.

A rewrite is kept only if: (1) the rewritten sentence stays close in meaning, (2) the CTA survives
if it was there, (3) campaign keywords and glossary terms survive, and (4) re-running the
deterministic filters on the patched text finds nothing new and the original issue is gone.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Callable
from difflib import SequenceMatcher
from typing import Any

import numpy as np
import numpy.typing as npt

from brandlens_worker import config
from brandlens_worker.pipeline.confidence import spans_overlap
from brandlens_worker.pipeline.filters import run_filters
from brandlens_worker.pipeline.ingest import normalise
from brandlens_worker.pipeline.types import Doc, Finding, Vault

Embed = Callable[[list[str]], npt.NDArray[np.float32]]
CTA_RATIO = 0.9


def _sentence_bounds(text: str, start: int, end: int) -> tuple[int, int]:
    left = max(text.rfind(c, 0, start) for c in ".!?\n") + 1
    rights = [i for i in (text.find(c, end) for c in ".!?\n") if i != -1]
    right = min(rights) + 1 if rights else len(text)
    return left, right


def _contains_fuzzy(haystack: str, needle: str, ratio: float = CTA_RATIO) -> bool:
    h, n = haystack.lower(), needle.lower().strip()
    if not n:
        return True
    if n in h:
        return True
    width = len(n)
    for i in range(0, max(1, len(h) - width + 1)):
        if SequenceMatcher(None, h[i : i + width], n).ratio() >= ratio:
            return True
    return False


def _keywords(vault: Vault, original: str) -> list[str]:
    tokens = [t for t in re.findall(r"[A-Za-z]{3,}", vault.campaign_name)]
    terms = [g.preferred for g in vault.glossary]
    return [k for k in tokens + terms if k.lower() in original.lower()]


def _key(f: Finding) -> tuple[str, tuple[str, ...]]:
    return f.dimension, tuple(f.codes)


def verify_rewrite(
    finding: Finding,
    doc: Doc,
    vault: Vault,
    intent: dict[str, Any],
    *,
    embed: Embed | None,
    baseline: list[Finding] | None = None,
) -> tuple[bool, str]:
    """Return (ok, reason). `baseline` = deterministic findings on the unpatched text."""
    if not finding.rewrite:
        return False, "no_rewrite"
    text = doc.text
    patched = text[: finding.start] + finding.rewrite + text[finding.end :]
    new_end = finding.start + len(finding.rewrite)

    # 1. meaning preserved at sentence level
    if embed is not None:
        s0, e0 = _sentence_bounds(text, finding.start, finding.end)
        s1, e1 = _sentence_bounds(patched, finding.start, new_end)
        vecs = embed([text[s0:e0], patched[s1:e1]])
        if float(np.dot(vecs[0], vecs[1])) < config.INTENT_COSINE:
            return False, "meaning_drift"

    # 2. CTA kept if it was present
    cta = str(intent.get("cta") or "")
    if cta and _contains_fuzzy(text, cta) and not _contains_fuzzy(patched, cta):
        return False, "cta_dropped"

    # 3. campaign keywords and glossary terms kept
    for kw in _keywords(vault, text):
        if kw.lower() not in patched.lower():
            return False, "keyword_dropped"

    # 4. no new deterministic finding, and the original issue no longer fires in the patched region
    before = Counter(
        _key(f) for f in (baseline if baseline is not None else run_filters(doc, vault))
    )
    after_findings = run_filters(normalise(patched), vault)
    for f in after_findings:
        if _key(f) == _key(finding) and spans_overlap((f.start, f.end), (finding.start, new_end)):
            return False, "still_fires"
    after = Counter(_key(f) for f in after_findings)
    if any(after[k] > before[k] for k in after):
        return False, "new_violation"
    return True, "ok"


def verify_all(
    findings: list[Finding],
    doc: Doc,
    vault: Vault,
    intent: dict[str, Any],
    *,
    embed: Embed | None,
    baseline: list[Finding],
) -> Counter[str]:
    """Null failing rewrites in place; return failure counts by reason."""
    failures: Counter[str] = Counter()
    for f in findings:
        if not f.rewrite:
            continue
        ok, reason = verify_rewrite(f, doc, vault, intent, embed=embed, baseline=baseline)
        if not ok:
            f.rewrite = None
            failures[reason] += 1
    return failures
