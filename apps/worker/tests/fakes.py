"""Fake LLM providers for router tests. No network."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from brandlens_worker.llm.base import BaseProvider, Image, Meta, RawCompletion, T


class Answer(BaseModel):
    brand: str
    word_count: int


class ScriptedProvider:
    """`generate_structured` replays a script: each step is an exception to raise or a dict."""

    def __init__(self, name: str, script: list[Any]) -> None:
        self.name = name
        self.script = list(script)
        self.calls = 0

    def model_for(self, *, vision: bool) -> str:
        return f"{self.name}-{'vision' if vision else 'text'}"

    async def generate_structured(
        self,
        system: str,
        user: str,
        schema: type[T],
        *,
        vision_images: list[Image] | None = None,
        temperature: float = 0.2,
    ) -> tuple[T, Meta]:
        self.calls += 1
        step = self.script.pop(0)
        if isinstance(step, BaseException):
            raise step
        return schema.model_validate(step), Meta(
            provider=self.name, model=self.model_for(vision=False), latency_ms=1
        )


class RawProvider(BaseProvider):
    """BaseProvider with a scripted `_complete`, to exercise the validation retry."""

    def __init__(self, texts: list[str], on_call: Callable[[str], None] | None = None) -> None:
        self.name = "raw"
        self.texts = list(texts)
        self.users: list[str] = []
        self.on_call = on_call

    def model_for(self, *, vision: bool) -> str:
        return "raw-model"

    async def _complete(
        self,
        system: str,
        user: str,
        schema: type[BaseModel],
        *,
        model: str,
        images: list[Image] | None,
        temperature: float,
    ) -> RawCompletion:
        self.users.append(user)
        return RawCompletion(text=self.texts.pop(0), model=model, input_tokens=10, output_tokens=5)
