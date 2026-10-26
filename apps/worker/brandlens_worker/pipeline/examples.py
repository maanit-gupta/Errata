"""Few-shot examples for an UNCLEAR rule (SPEC §11): the prompt input and output validation.

Pure functions; the job (`jobs/generate_examples.py`) does the I/O and the one LLM call.
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from brandlens_worker.pipeline.protect import detect

MAX_DISMISSED = 8


class Example(BaseModel):
    kind: Literal["do", "dont"]
    text: str = Field(min_length=3, max_length=160)
    why: str = Field(min_length=3, max_length=160)


class ExamplesOutput(BaseModel):
    examples: list[Example] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def both_kinds(self) -> ExamplesOutput:
        kinds = {e.kind for e in self.examples}
        if kinds != {"do", "dont"}:
            raise ValueError("include at least one 'do' and one 'dont' example")
        return self


def redact(text: str) -> str:
    """Same detectors as stage 2; dismissed quotes go to an external LLM (invariant 5)."""
    out, cursor = [], 0
    for r in detect(text):
        out += [text[cursor : r.start], f"⟦REDACTED:{r.kind}⟧"]
        cursor = r.end
    return "".join([*out, text[cursor:]])


def build_message(
    code: str, title: str, body: str, examples: list[dict[str, str]], dismissed: list[str]
) -> str:
    """The rule (and its existing examples) plus up to MAX_DISMISSED distinct dismissed quotes."""
    seen: list[str] = []
    for q in dismissed:
        q = redact(q.strip())
        if q and q not in seen:
            seen.append(q)
    existing = "; ".join(f"{e.get('kind')}: {e.get('text')}" for e in examples) or "none"
    return "\n".join(
        [
            f"<rule>{json.dumps({'code': code, 'title': title, 'body': body}, ensure_ascii=False)}"
            "</rule>",
            f"<existing_examples>{existing}</existing_examples>",
            "<dismissed>",
            *seen[:MAX_DISMISSED],
            "</dismissed>",
        ]
    )


def novel(out: ExamplesOutput, dismissed: list[str]) -> list[dict[str, str]]:
    """Drop examples that just copy a dismissed phrase; the rest, as `rule_cards.examples` items."""
    bad = {q.strip().lower() for q in dismissed}
    return [
        {"kind": e.kind, "text": e.text.strip(), "why": e.why.strip()}
        for e in out.examples
        if e.text.strip().lower() not in bad
    ]
