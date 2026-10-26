from types import SimpleNamespace

from brandlens_worker.notify import needs_review_payload, notify_needs_review


def test_payload_has_link_route_and_no_body() -> None:
    p = needs_review_payload("Diwali caption", "c1", "legal", 9.0, "https://brandlens.example/")
    embed = p["embeds"][0]
    assert embed["url"] == "https://brandlens.example/review/c1"
    assert "legal" in embed["description"] and "9.0" in embed["description"]


async def test_notify_is_a_noop_without_config() -> None:
    notify_needs_review(
        SimpleNamespace(discord_webhook_url=None, site_url=None),
        title="t",
        content_id="c",
        route_to="manager",
        risk=None,
    )
