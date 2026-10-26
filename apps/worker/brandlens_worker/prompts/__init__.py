"""Versioned prompt files. The first line of each is `PROMPT_VERSION: <name>@<n>` (SPEC §13)."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent
_HEADER = re.compile(r"^PROMPT_VERSION:\s*(?P<version>[a-z0-9_]+@\d+)\s*$")
_FILE = re.compile(r"^(?P<name>[a-z0-9_]+)_v(?P<n>\d+)\.md$")


class PromptError(RuntimeError):
    pass


def _versions(name: str, directory: Path) -> list[tuple[int, Path]]:
    found = []
    for path in directory.glob(f"{name}_v*.md"):
        m = _FILE.match(path.name)
        if m and m["name"] == name:
            found.append((int(m["n"]), path))
    return sorted(found)


def parse_prompt(text: str, *, source: str = "<prompt>") -> tuple[str, str]:
    first, _, body = text.partition("\n")
    m = _HEADER.match(first.strip())
    if not m:
        raise PromptError(f"{source}: first line must be 'PROMPT_VERSION: name@N'")
    return body.lstrip("\n"), m["version"]


@lru_cache(maxsize=64)
def load_prompt(name: str, directory: Path = PROMPTS_DIR) -> tuple[str, str]:
    """Return (text, version) for `name` (latest `name_vN.md`) or an exact `name_vN`."""
    exact = directory / f"{name}.md"
    if _FILE.match(exact.name) and exact.exists():
        path = exact
    else:
        versions = _versions(name, directory)
        if not versions:
            raise PromptError(f"no prompt named {name!r} in {directory}")
        path = versions[-1][1]
    text, version = parse_prompt(path.read_text(), source=path.name)
    m = _FILE.match(path.name)
    if m and version != f"{m['name']}@{m['n']}":
        raise PromptError(f"{path.name}: header says {version}, filename says {m['name']}@{m['n']}")
    return text, version
