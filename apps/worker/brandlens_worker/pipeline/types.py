"""Shared pipeline types."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

Dimension = Literal["tone", "terms", "facts", "claims", "visual", "access"]
Severity = Literal["blocker", "warning", "suggestion"]


@dataclass(frozen=True)
class Segment:
    text: str
    start: int
    end: int
    page: int | None = None
    bbox: tuple[float, float, float, float] | None = None


@dataclass
class Doc:
    """Normalised draft text. `char_map[i]` is the index in `original` of `text[i]`."""

    text: str
    original: str
    char_map: list[int]
    segments: list[Segment] = field(default_factory=list)
    images: list[bytes] = field(default_factory=list)

    def bbox_for(self, start: int, end: int) -> tuple[int, int, int, int] | None:
        """Pixel box covering [start, end) in `text`, for docs built from an image (OCR)."""
        boxes = [s.bbox for s in self.segments if s.bbox and s.start < end and s.end > start]
        if not boxes:
            return None
        return (
            int(min(b[0] for b in boxes)),
            int(min(b[1] for b in boxes)),
            int(max(b[2] for b in boxes)),
            int(max(b[3] for b in boxes)),
        )

    def to_original(self, start: int, end: int) -> tuple[int, int]:
        """Map a [start, end) span in `text` back to `original`."""
        if start >= end:
            o = self.char_map[start] if start < len(self.char_map) else len(self.original)
            return o, o
        return self.char_map[start], self.char_map[end - 1] + 1

    @property
    def word_count(self) -> int:
        return len(self.text.split())


@dataclass(frozen=True)
class Redaction:
    kind: str
    start: int  # in Doc.text
    end: int


@dataclass
class RedactedDoc:
    """The LLM-bound copy. Deterministic stages never see this; they use the original Doc."""

    text: str
    redactions: list[Redaction]


@dataclass(frozen=True)
class Rule:
    id: str
    code: str
    dimension: Dimension
    title: str
    body: str
    severity: Severity
    examples: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class Fact:
    id: str
    code: str
    kind: str
    statement: str
    value: dict[str, Any]
    campaign_id: str | None
    campaign_name: str | None
    required_disclaimer: str | None = None
    valid_until: datetime | None = None


@dataclass(frozen=True)
class GlossaryTerm:
    code: str
    preferred: str
    variants: list[str]
    banned: bool = False
    case_sensitive: bool = True


@dataclass
class Vault:
    """Everything the deterministic filters need for one review. `facts` holds ALL org facts
    (other campaigns and expired ones too) so bleed and expiry can be detected."""

    campaign_id: str
    campaign_name: str
    rules: list[Rule]
    facts: list[Fact]
    glossary: list[GlossaryTerm]
    now: datetime

    def rule(self, code: str) -> Rule | None:
        return next((r for r in self.rules if r.code == code), None)

    def rules_for(self, dimension: str) -> list[Rule]:
        return [r for r in self.rules if r.dimension == dimension]

    def in_scope(self, fact: Fact) -> bool:
        return fact.campaign_id is None or fact.campaign_id == self.campaign_id


Target = Literal["text", "image", "alt_text"]


@dataclass
class Finding:
    """A finding before persistence. Spans are in `Doc.text`; the job maps them to the original.

    Image findings: `target="image"` findings point at a pixel `bbox` and carry their own `quote`
    (a short label such as "Logo, 64 px wide"); `target="alt_text"` spans index the alt text.
    """

    dimension: Dimension
    start: int
    end: int
    severity: Severity
    explanation: str
    rule_id: str | None = None
    fact_id: str | None = None
    wcag_ref: str | None = None
    codes: list[str] = field(default_factory=list)  # cited codes, primary first
    rewrite: str | None = None
    source: Literal["deterministic", "llm"] = "deterministic"
    confidence: float = 1.0
    target: Target = "text"
    bbox: tuple[int, int, int, int] | None = None
    quote: str | None = None  # overrides the text slice (image and alt-text targets)

    @property
    def cited(self) -> bool:
        return bool(self.rule_id or self.fact_id or self.wcag_ref)
