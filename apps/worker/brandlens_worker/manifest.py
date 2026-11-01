"""R3 Hero 2: the publish manifest's hash input, mirrored from SQL `private.normalise_body`.

The manifest itself is issued in SQL when content becomes publish_ready (migration
20261101100026_fact_kill_switch.sql); this module lets anyone recompute the hash from a copy of the
text and compare it with the receipt. Normalisation: strip ASCII whitespace at both ends and
collapse runs of ASCII whitespace (space, tab, newline, CR, form feed, vertical tab) to one space.
"""

from __future__ import annotations

import hashlib
import re

_WS = " \t\n\r\f\v"
_RUN = re.compile(r"[ \t\n\r\f\v]+")


def normalise_body(body: str | None) -> str:
    return _RUN.sub(" ", (body or "").strip(_WS))


def content_sha256(body: str | None) -> str:
    return hashlib.sha256(normalise_body(body).encode("utf-8")).hexdigest()
