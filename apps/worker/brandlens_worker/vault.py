"""Vault text used for embeddings (pure). Embedding text is hashed so only changed rows re-embed."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any


def rule_embed_text(row: Mapping[str, Any]) -> str:
    """title + summary + body + examples (P04 task 3)."""
    lines = [str(row["title"]), str(row["summary"]), str(row["body"])]
    for ex in row.get("examples") or []:
        kind = "Do" if ex.get("kind") == "do" else "Don't"
        lines.append(f"{kind}: {ex.get('text', '')}")
    return "\n".join(lines)


def fact_embed_text(row: Mapping[str, Any]) -> str:
    """statement + value."""
    value = row.get("value") or {}
    return f"{row['statement']}\n{json.dumps(value, sort_keys=True, ensure_ascii=False)}"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


@dataclass(frozen=True)
class EmbedTask:
    table: str  # "rule_cards" | "facts"
    id: str
    text: str
    hash: str


def plan_embeddings(
    rules: Iterable[Mapping[str, Any]], facts: Iterable[Mapping[str, Any]]
) -> list[EmbedTask]:
    """Rows that need (re-)embedding: no embedding yet, or their text changed since it was made.

    `rules` must already be filtered to approved cards. Each row needs `has_embedding` and
    `embedding_source_hash` besides its content columns.
    """
    tasks: list[EmbedTask] = []
    for table, rows, to_text in (
        ("rule_cards", rules, rule_embed_text),
        ("facts", facts, fact_embed_text),
    ):
        for row in rows:
            text = to_text(row)
            h = text_hash(text)
            if not row.get("has_embedding") or row.get("embedding_source_hash") != h:
                tasks.append(EmbedTask(table=table, id=str(row["id"]), text=text, hash=h))
    return tasks
