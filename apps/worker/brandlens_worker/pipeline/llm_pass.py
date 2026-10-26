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


class VisionFinding(BaseModel):
    """A finding from the vision pass (prompts/vision_v*.md). `target` says what it points at."""

    target: Literal["text", "image", "alt_text"]
    dimension: Literal["tone", "terms", "facts", "claims", "visual", "access"]
    cites: list[str] = Field(min_length=1, max_length=4)
    quote: str | None = Field(default=None, max_length=300)
    severity: Literal["blocker", "warning", "suggestion"]
    explanation: str = Field(min_length=1, max_length=600)
    rewrite: str | None = Field(default=None, max_length=600)
    self_confidence: float = Field(default=0.5, ge=0, le=1)

    def as_text_finding(self) -> LLMFinding | None:
        if self.target != "text" or not self.quote:
            return None
        return LLMFinding.model_validate(self.model_dump(exclude={"target"}))


class VisionReviewOutput(BaseModel):
    findings: list[VisionFinding] = Field(default_factory=list, max_length=20)


@dataclass
class LLMPassResult:
    findings: list[Any]  # LLMFinding (text) or VisionFinding (images)
    meta: Meta
    confirmation: list[Any] | None
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


def build_vision_message(
    redacted: RedactedDoc,
    intent: dict[str, Any],
    vault: Vault,
    retrieved: list[dict[str, Any]],
    already: list[Finding],
    doc: Doc,
    *,
    alt_text: str | None,
    signals: dict[str, Any],
) -> str:
    """The review message plus the alt text and the deterministic image signals."""
    base = build_user_message(redacted, intent, vault, retrieved, already, doc)
    found_image = [
        f"{f.dimension} | {f.quote!r} | {', '.join(f.codes)}" for f in already if f.target != "text"
    ]
    if found_image:
        base = base.replace("</already_found>", "\n".join([*found_image, "</already_found>"]))
    return "\n".join(
        [
            base,
            f"<alt_text>{alt_text.strip() if alt_text else ''}</alt_text>",
            f"<image_signals>{json.dumps(signals, sort_keys=True)}</image_signals>",
        ]
    )


async def run_llm_pass(
    router: Any,
    system: str,
    prompt_version: str,
    user: str,
    *,
    schema: type[BaseModel] = LLMReviewOutput,
    images: list[Any] | None = None,
) -> LLMPassResult:
    """Main sample at 0.2; a confirmation sample at 0.7 only if a blocker was returned (SPEC §7)."""
    out, meta = await router.generate(
        system, user, schema, prompt_version=prompt_version, temperature=0.2, vision_images=images
    )
    confirmation: list[Any] | None = None
    confirmation_meta: Meta | None = None
    if any(f.severity == "blocker" for f in out.findings):
        second, confirmation_meta = await router.generate(
            system,
            user,
            schema,
            prompt_version=prompt_version,
            temperature=CONFIRM_TEMPERATURE,
            vision_images=images,
        )
        confirmation = second.findings
    return LLMPassResult(out.findings, meta, confirmation, confirmation_meta, prompt_version)
