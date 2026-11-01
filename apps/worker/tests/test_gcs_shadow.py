"""Hero 5 (GCS shadow sandbox): the projection's rules, and the authenticated API with fakes."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from brandlens_worker import config
from brandlens_worker.heroes.api import build_router
from brandlens_worker.heroes.gcs_shadow import SampleFinding, gcs, project


class KeywordEmbedder:
    """Deterministic stand-in: 'festive' words point one way, 'jackpot' words the other."""

    def embed(self, texts: Sequence[str]) -> Any:
        out = []
        for t in texts:
            t = t.lower()
            out.append([1.0 if ("jackpot" in t or "money" in t) else 0.0,
                        1.0 if "festive" in t else 0.0, 0.1])  # fmt: skip
        return np.asarray(out)


CURRENT = {
    "n": 12,
    "dismissal_rate": 0.5,
    "override_rate": 0.2,
    "low_confidence_rate": 0.1,
    "gcs": 66,
}


def sample(fp_festive: int, tp_jackpot: int, tp_festive: int = 0) -> list[SampleFinding]:
    rows = [SampleFinding(f"fp{i}", "a festive Diwali glow", True) for i in range(fp_festive)]
    rows += [SampleFinding(f"tp{i}", "hit the jackpot", False) for i in range(tp_jackpot)]
    rows += [
        SampleFinding(f"tq{i}", "festive returns guaranteed", False) for i in range(tp_festive)
    ]
    return rows


def run(
    rows: list[SampleFinding], current: dict[str, Any] | None = CURRENT, do: list[str] | None = None
) -> Any:
    return project(
        rule_code="TV-04", current=current, sample=rows,
        rule_body="Never joke about money.", do_examples=do if do is not None else ["festive Diwali fun"],
        dont_examples=["Diwali jackpot"], embed=KeywordEmbedder().embed,
    )  # fmt: skip


def test_formula_matches_sql() -> None:
    assert gcs(0, 0, 0) == 100 and gcs(1, 1, 1) == 0
    assert gcs(0.5, 0.2, 0.1) == round(100 * (1 - (0.45 * 0.5 + 0.35 * 0.2 + 0.2 * 0.1)))


def test_dismissed_quotes_closer_to_do_examples_stop_triggering() -> None:
    r = run(sample(fp_festive=6, tp_jackpot=6))
    assert r.status == "projection" and r.sample_size == 12
    assert r.false_positives_removed == 6 and r.true_positives_lost == 0
    assert r.sample_dismissal_rate == 0.5 and r.projected_dismissal_rate == 0.0
    # Override and low-confidence rates are held, never invented.
    assert r.override_rate == 0.2 and r.low_confidence_rate == 0.1
    assert r.projected_gcs == gcs(0.0, 0.2, 0.1)
    assert r.current_gcs == 66 and "Projection" in r.note


def test_true_positives_the_clarified_rule_would_miss_are_reported() -> None:
    r = run(sample(fp_festive=5, tp_jackpot=4, tp_festive=3))
    assert r.true_positives_lost == 3 and r.false_positives_removed == 5


@pytest.mark.parametrize("n", [0, 1, config.GCS_MIN_N - 1])
def test_insufficient_data_gives_no_numbers(n: int) -> None:
    r = run(sample(fp_festive=n, tp_jackpot=0))
    assert r.status == "insufficient_data"
    assert r.projected_gcs is None and r.projected_dismissal_rate is None
    assert r.false_positives_removed == 0 and r.true_positives_lost == 0


def test_no_current_score_or_no_do_examples_is_insufficient() -> None:
    assert run(sample(6, 6), current=None).status == "insufficient_data"
    assert run(sample(6, 6), current=None).current_gcs is None  # never a made-up 60
    assert run(sample(6, 6), do=[]).status == "insufficient_data"


def test_deterministic() -> None:
    assert run(sample(6, 6, 2)).to_json() == run(sample(6, 6, 2)).to_json()


# --- API -----------------------------------------------------------------------------------------

RULE = {"id": "11111111-1111-4111-8111-111111111111", "org_id": "org-1", "code": "TV-04",
        "title": "Playful", "body": "Never joke about money.", "status": "approved"}  # fmt: skip


class FakeVerifier:
    async def user_id(self, token: str) -> str | None:
        return {"tok-admin": "u-admin", "tok-creator": "u-creator", "tok-other": "u-other"}.get(
            token
        )


class FakeStore:
    async def rule(self, rule_id: str) -> dict[str, Any] | None:
        return RULE if rule_id == RULE["id"] else None

    async def role(self, user_id: str, org_id: str) -> str | None:
        return {"u-admin": "brand_admin", "u-creator": "creator"}.get(user_id)

    async def current_gcs(
        self, org_id: str, rule_id: str, include_simulated: bool
    ) -> dict[str, Any]:
        return CURRENT

    async def sample(
        self, org_id: str, rule_id: str, include_simulated: bool, limit: int
    ) -> list[SampleFinding]:
        return sample(6, 6)[:limit]


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.state.services = {"user_verifier": FakeVerifier(), "hero_store": FakeStore(),
                          "embedder": KeywordEmbedder()}  # fmt: skip
    app.include_router(build_router())
    return TestClient(app)


def post(c: TestClient, token: str | None, **body: Any) -> Any:
    payload = {"rule_id": RULE["id"], "do_examples": ["festive Diwali fun"], **body}
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return c.post("/v1/heroes/simulate-rule", json=payload, headers=headers)


def test_auth_and_scope(client: TestClient) -> None:
    assert post(client, None).status_code == 401
    assert post(client, "tok-bogus").status_code == 401
    assert post(client, "tok-creator").status_code == 404  # wrong role: same answer as no rule
    assert post(client, "tok-other").status_code == 404  # not a member
    assert (
        post(client, "tok-admin", rule_id="22222222-2222-4222-8222-222222222222").status_code == 404
    )
    ok = post(client, "tok-admin")
    assert ok.status_code == 200 and ok.json()["status"] == "projection"


def test_validation(client: TestClient) -> None:
    assert post(client, "tok-admin", do_examples=[]).status_code == 422
    assert post(client, "tok-admin", org_id="org-2").status_code == 422  # scope isn't an input
    assert post(client, "tok-admin", do_examples=["x"] * 11).status_code == 422


def test_rate_limit(client: TestClient) -> None:
    for _ in range(30):
        assert post(client, "tok-admin").status_code == 200
    assert post(client, "tok-admin").status_code == 429


def test_logs_ids_only(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO):
        post(client, "tok-admin", do_examples=["SECRET-EXAMPLE festive"])
    dumped = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert "SECRET-EXAMPLE" not in dumped and "tok-admin" not in dumped and "u-admin" in dumped
