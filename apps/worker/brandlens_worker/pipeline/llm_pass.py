"""Stage 5: one structured LLM call for the judgement dimensions (SPEC §6, §13).

The LLM is untrusted: the draft is delimited data (already redacted), output is schema-bound, and
every finding still has to pass the citation gate. Only retrieved snippets are sent (never the
vault, never `never_send` items, which `match_vault` excludes).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field

from brandlens_worker.llm.base import Meta
from brandlens_worker.pipeline.types import Doc, Finding, RedactedDoc, Vault

CONFIRM_TEMPERATURE = 0.7


class LLMFinding(BaseModel):
    dimension: Literal["tone", "terms", "facts", "claims", "visual", "access"]
    cites: list[str] = Field(min_length=1, max_length=4)
    quote: str = Field(min_length=1, max_length=300)
    severity: Literal["blocker", "warning", "suggestion"]
    explanation: str = Field(min_length=1, max_length=600)
    rewrite: str | None = Field(default=None, max_length=600)
    self_confidence: float = Field(default=0.5, ge=0, le=1)


class LLMReviewOutput(BaseModel):
    findings: list[LLMFinding] = Field(default_factory=list, max_length=20)


@dataclass
class LLMPassResult:
    findings: list[LLMFinding]
    meta: Meta
    confirmation: list[LLMFinding] | None
    confirmation_meta: Meta | None
    prompt_version: str


def _intent_block(intent: dict[str, Any], campaign_name: str) -> str:
    keep = {k: intent.get(k) for k in ("goal", "audience", "cta", "channel")}
    keep["campaign"] = campaign_name
    return json.dumps(keep, ensure_ascii=False)


def build_user_message(
    redacted: RedactedDoc,
    intent: dict[str, Any],
    vault: Vault,
    retrieved: list[dict[str, Any]],
    already: list[Finding],
    doc: Doc,
) -> str:
    rules = {r.id: r for r in vault.rules}
    facts = {f.id: f for f in vault.facts}
    rule_lines, fact_lines = [], []
    for item in retrieved:
        if item["kind"] == "rule" and item["id"] in rules:
            r = rules[item["id"]]
            examples = "; ".join(
                f"{'Do' if e.get('kind') == 'do' else 'Dont'}: {e.get('text', '')}"
                for e in r.examples
            )
            rule_lines.append(
                f"{r.code} | {r.dimension} | {r.severity} | {r.title} | {r.body} | {examples}"
            )
        elif item["kind"] == "fact" and item["id"] in facts:
            f = facts[item["id"]]
            value = json.dumps(f.value, ensure_ascii=False, sort_keys=True)
            fact_lines.append(f"{f.code} | {f.statement} | {value} | {f.required_disclaimer or ''}")
    found = [
        f"{f.dimension} | {doc.text[f.start : f.end]!r} | {', '.join(f.codes)}" for f in already
    ]
    return "\n".join(
        [
            f"<intent>{_intent_block(intent, vault.campaign_name)}</intent>",
            "<rules>",
            *rule_lines,
            "</rules>",
            "<facts>",
            *fact_lines,
            "</facts>",
            "<already_found>",
            *found,
            "</already_found>",
            f"<draft>\n{redacted.text}\n</draft>",
        ]
    )


async def run_llm_pass(router: Any, system: str, prompt_version: str, user: str) -> LLMPassResult:
    """Main sample at 0.2; a confirmation sample at 0.7 only if a blocker was returned (SPEC §7)."""
    out, meta = await router.generate(
        system, user, LLMReviewOutput, prompt_version=prompt_version, temperature=0.2
    )
    confirmation: list[LLMFinding] | None = None
    confirmation_meta: Meta | None = None
    if any(f.severity == "blocker" for f in out.findings):
        second, confirmation_meta = await router.generate(
            system,
            user,
            LLMReviewOutput,
            prompt_version=prompt_version,
            temperature=CONFIRM_TEMPERATURE,
        )
        confirmation = second.findings
    return LLMPassResult(out.findings, meta, confirmation, confirmation_meta, prompt_version)
