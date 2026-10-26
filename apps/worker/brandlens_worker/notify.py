"""Discord "needs review" notifications for transitions the worker makes (SPEC §15).

Optional (only when DISCORD_WEBHOOK_URL is set), fire-and-forget, never raises, never includes
draft text: title, route, risk and a link only.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)
_tasks: set[asyncio.Task[None]] = set()


def needs_review_payload(
    title: str, content_id: str, route_to: str, risk: float | None, site_url: str
) -> dict[str, Any]:
    link = f"{site_url.rstrip('/')}/review/{content_id}"
    return {
        "embeds": [
            {
                "title": f"📝 {title} needs review",
                "description": f"Route: **{route_to}** · risk {risk if risk is not None else '–'}",
                "url": link,
                "color": 0x141414,
            }
        ]
    }


async def _post(url: str, payload: dict[str, Any]) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.post(url, json=payload)
        if res.status_code >= 300:
            log.warning("discord notify failed", extra={"status": res.status_code})
        else:
            log.info("discord notified", extra={"status": res.status_code})
    except Exception as exc:
        log.warning("discord notify failed", extra={"error": type(exc).__name__})


def notify_needs_review(
    settings: Any, *, title: str, content_id: str, route_to: str, risk: float | None
) -> None:
    """Schedule the message and return immediately."""
    if not getattr(settings, "discord_webhook_url", None) or not getattr(
        settings, "site_url", None
    ):
        return
    payload = needs_review_payload(title, content_id, route_to, risk, settings.site_url)
    task = asyncio.create_task(_post(settings.discord_webhook_url.get_secret_value(), payload))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
