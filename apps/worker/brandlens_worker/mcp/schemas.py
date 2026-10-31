"""Strict Pydantic v2 inputs and outputs for the MCP tools (build spec §4.3, read-only subset).

Unknown fields are rejected (`extra="forbid"`), so a caller can't smuggle in an org or a role.
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from brandlens_worker import config


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DraftIntent(_Strict):
    goal: str = Field(..., min_length=3, max_length=200, description="e.g. 'webinar sign-ups'")
    audience: str = Field(
        ..., min_length=3, max_length=200, description="e.g. 'first-time investors'"
    )
    cta: str = Field(
        ..., min_length=2, max_length=100, description="Mandatory CTA, e.g. 'Register now'"
    )
    channel: str = Field(
        default="instagram_caption", max_length=50, description="e.g. 'instagram_caption'"
    )


class GetCampaignContextInput(_Strict):
    campaign_query: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Campaign name or part of it, e.g. 'Diwali SIP'",
    )
    intent: DraftIntent


class PrecheckDraftFastInput(_Strict):
    draft_text: str = Field(..., min_length=5, max_length=15_000)
    campaign_id: UUID
    intent: DraftIntent
    baseline_text: str | None = Field(
        default=None,
        max_length=15_000,
        description="Optional earlier draft; the new one must keep its meaning (local check).",
    )


class VerifyClaimEvidenceInput(_Strict):
    claim_statement: str = Field(
        ...,
        min_length=3,
        max_length=config.MCP_MAX_QUERY_CHARS,
        description="One claim to check, e.g. '14.2% assured annual returns'",
    )
    campaign_id: UUID


class CitedFindingOut(BaseModel):
    code: str = Field(..., description="Primary cited rule or fact code, e.g. 'CL-03', 'E-19'")
    also_cites: list[str] = Field(default_factory=list)
    dimension: Literal["tone", "terms", "facts", "claims", "visual", "access"]
    severity: Literal["blocker", "warning", "suggestion"]
    quote: str
    span: dict[str, int] = Field(
        ..., description="Character offsets {'start', 'end'} in draft_text"
    )
    confidence: float = Field(..., ge=0.0, le=1.0)
    source: Literal["deterministic", "llm"]
    explanation: str
    suggested_fix: str | None = None


def input_schema(model: type[BaseModel]) -> dict[str, Any]:
    """JSON Schema for tools/list, with $defs inlined by Pydantic's own references."""
    schema = model.model_json_schema()
    schema["additionalProperties"] = False
    return schema
