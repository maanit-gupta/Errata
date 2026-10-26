"""Simulate 30 days of PayWise review activity for the insights dashboard (P13). All fictional.

    make simulate-activity                      (local stack)
    make simulate-activity url=<SUPABASE_URL>   (cloud; must match apps/worker/.env)

Writes ~200 archived "[Simulated]" contents with versions, finished review runs, findings,
dismissals and review decisions, back-dated over the last 30 days, so the Guideline watchlist lands
as in plan p.19: TV-04 UNCLEAR (~60), VS-02 watch (~73), CL-03 and G-07 clear. Every simulated
content gets an `audit_events` row with `simulated: true`, which turns on the "Illustrative data"
pill. Contents are archived through the real state machine (`private.apply_transition`) so they
never appear in anyone's drafts or review queue. Re-running first deletes earlier simulated
contents (audit events are append-only and stay). Then `flag_unclear_rules` queues example
generation for rules that crossed into UNCLEAR.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import demo_data as d

CREATOR = d.USERS[1][0]
MANAGER = d.USERS[3][0]
PREFIX = "[Simulated] "


@dataclass(frozen=True)
class RuleSpec:
    """Targets for one rule over the window (see the module docstring)."""

    code: str
    dimension: str
    severity: str
    source: str  # deterministic | llm
    n: int  # findings
    versions: int  # versions they're spread over
    reviewed: int  # versions with a review decision
    overridden: int  # reviewed versions approved with an open finding
    dismissed: int  # findings dismissed as "doesn't apply"
    low_conf: int  # findings with confidence < 0.6
    quotes: tuple[str, ...]
    image: bool = False


SPECS: tuple[RuleSpec, ...] = (
    RuleSpec("TV-04", "tone", "suggestion", "llm", 41, 14, 11, 4, 20, 11,
             ("Diwali jackpot: bet big on your SIP", "Roll the dice on mid-caps this Diwali",
              "Don't be a party pooper, start investing", "Make your money do the bhangra",
              "Light up your portfolio like a firecracker")),
    RuleSpec("VS-02", "visual", "warning", "llm", 22, 10, 8, 3, 5, 4,
             ("Cool blue cast on the hero photo", "Desaturated stock image"), image=True),
    RuleSpec("CL-03", "claims", "blocker", "deterministic", 63, 45, 36, 0, 2, 3,
             ("assured 12% returns", "guaranteed returns", "risk-free SIP", "lock in 14.2%")),
    RuleSpec("G-07", "terms", "warning", "deterministic", 88, 60, 45, 0, 1, 0,
             ("Paywise app", "Paywise", "Pay Wise")),
)  # fmt: skip
FACT_FINDINGS = 27  # E-19 date/venue drift (blockers): "cross-campaign date or venue"
BLOCKERS_THIS_WEEK = 9
FIRST_REVIEW_APPROVE = 0.72


@dataclass
class SimFinding:
    code: str
    dimension: str
    severity: str
    source: str
    quote: str
    confidence: float
    status: str = "open"
    dismiss_reason: str | None = None
    fact: bool = False
    image: bool = False


@dataclass
class SimContent:
    title: str
    created: datetime
    findings: list[SimFinding] = field(default_factory=list)
    decision: str | None = None  # approve | request_changes
    decided: datetime | None = None
    reason: str | None = None
    override: bool = False  # approved with its first finding still open


def plan(now: datetime, seed: int = 26) -> list[SimContent]:
    """Pure: the simulated history, deterministic for a seed."""
    rng = random.Random(seed)
    out: list[SimContent] = []

    def created() -> datetime:
        return now - timedelta(days=rng.uniform(7.5, 29.5))

    for spec in SPECS:
        contents = [
            SimContent(f"{PREFIX}{spec.code} draft {i + 1}", created())
            for i in range(spec.versions)
        ]
        for i in range(spec.n):
            c = contents[i % spec.versions]
            c.findings.append(
                SimFinding(spec.code, spec.dimension, spec.severity, spec.source,
                           spec.quotes[i % len(spec.quotes)],
                           0.45 if i < spec.low_conf else round(rng.uniform(0.7, 0.95), 2),
                           image=spec.image)
            )  # fmt: skip
        reviewed = contents[: spec.reviewed]
        for j, c in enumerate(reviewed):
            c.override = j < spec.overridden
            approve = c.override or rng.random() < FIRST_REVIEW_APPROVE
            c.decision = "approve" if approve else "request_changes"
            c.reason = None if approve else f"Please rework this against {spec.code}."
        # Resolve findings: overridden versions keep their first finding open; other reviewed
        # versions were fixed before review; dismissals are spread over everything else.
        dismissable = []
        for c in contents:
            for k, f in enumerate(c.findings):
                if c.override and k == 0:
                    continue
                if c.decision:
                    f.status = "accepted"
                dismissable.append(f)
        step = max(1, len(dismissable) // max(1, spec.dismissed))
        for f in dismissable[::step][: spec.dismissed]:
            f.status, f.dismiss_reason = "dismissed", "doesnt_apply"
        out += contents

    for i in range(FACT_FINDINGS):
        c = SimContent(f"{PREFIX}Webinar post {i + 1}", created())
        c.findings.append(
            SimFinding("E-19", "facts", "blocker", "deterministic", "Oct 18 at Hall B, Chandigarh",
                       1.0, status="accepted", fact=True)
        )  # fmt: skip
        out.append(c)

    # A reviewer blocks a CL-03-clean draft citing CL-03 (counts towards its override rate).
    c = SimContent(f"{PREFIX}Fund explainer", created())
    c.decision, c.reason = "request_changes", "CL-03: 'steady gains' still reads like a promise."
    out.append(c)

    # Everything else is 7.5-30 days old, so exactly BLOCKERS_THIS_WEEK one-blocker webinar posts
    # land in the last 7 days.
    webinar = [c for c in out if c.title.startswith(f"{PREFIX}Webinar")]
    for c in rng.sample(webinar, BLOCKERS_THIS_WEEK):
        c.created = now - timedelta(days=rng.uniform(0.6, 6.5))
    for c in out:
        if c.decision:
            c.decided = min(now - timedelta(minutes=5),
                            c.created + timedelta(days=rng.lognormvariate(0.3, 0.45)))  # fmt: skip
    return out


def expected_gcs(contents: list[SimContent]) -> dict[str, tuple[int, int]]:
    """SPEC §11 on the plan itself: {code: (N, GCS)}; the SQL `rule_gcs` must agree."""
    out = {}
    for spec in SPECS:
        fs = [f for c in contents for f in c.findings if f.code == spec.code]
        n = len(fs)
        dr = sum(f.dismiss_reason == "doesnt_apply" for f in fs) / n
        lcr = sum(f.confidence < 0.6 for f in fs) / n
        reviewed = [
            c for c in contents if c.decision and any(f.code == spec.code for f in c.findings)
        ]
        overridden = [c for c in reviewed if c.decision == "approve" and any(
            f.code == spec.code and f.status == "open" for f in c.findings)]  # fmt: skip
        blocks = [
            c for c in contents
            if c.decision == "request_changes" and spec.code in (c.reason or "")
            and not any(f.code == spec.code for f in c.findings)
        ]  # fmt: skip
        orr = (len(overridden) + len(blocks)) / max(1, len(reviewed) + len(blocks))
        out[spec.code] = (n, round(100 * (1 - (0.45 * dr + 0.35 * orr + 0.20 * lcr))))
    return out


def apply(conn: Any, contents: list[SimContent]) -> None:
    from psycopg.types.json import Jsonb

    ids = {}
    cur = conn.execute(
        "select code, id::text from public.rule_cards where org_id = %s and status = 'approved'",
        (d.ORG_ID,),
    )
    ids.update(dict(cur.fetchall()))
    cur = conn.execute("select code, id::text from public.facts where org_id = %s", (d.ORG_ID,))
    facts = dict(cur.fetchall())

    conn.execute(
        "delete from public.contents where org_id = %s and title like %s", (d.ORG_ID, PREFIX + "%")
    )
    for c in contents:
        image = any(f.image for f in c.findings)
        content_id = conn.execute(
            "insert into public.contents (org_id, campaign_id, owner_id, title, channel, format, "
            "created_at, updated_at) values (%s, %s, %s, %s, 'instagram_post', %s, %s, %s) "
            "returning id",
            (d.ORG_ID, d.DIWALI, CREATOR, c.title, "image" if image else "text", c.created,
             c.created),
        ).fetchone()[0]  # fmt: skip
        body = None if image else " ".join(f.quote + "." for f in c.findings) or "Start a SIP."
        version_id = conn.execute(
            "insert into public.versions (content_id, n, body, storage_path, format, intent, "
            "created_at) values (%s, 0, %s, %s, %s, %s, %s) returning id",
            # Simulated image versions point at a path with no file (they're archived history).
            (content_id, body, f"{d.ORG_ID}/{content_id}/simulated/creative.png" if image else None,
             "image" if image else "text",
             Jsonb({"goal": "sign-ups", "audience": "retail investors", "cta": "Start a SIP",
                    "channel": "instagram_post", "campaign_id": d.DIWALI}), c.created),
        ).fetchone()[0]  # fmt: skip
        ran = c.created + timedelta(minutes=2)
        run_id = conn.execute(
            "insert into public.review_runs (org_id, version_id, status, created_at, started_at, "
            "finished_at, provider, model_version, prompt_version) "
            "values (%s, %s, 'done', %s, %s, %s, 'simulated', 'simulated', 'review@1') "
            "returning id",
            (d.ORG_ID, version_id, ran, ran, ran + timedelta(seconds=6)),
        ).fetchone()[0]
        first_open: str | None = None
        pos = 0
        for f in c.findings:
            span = ({"x0": 0, "y0": 0, "x1": 1080, "y1": 1080} if f.image
                    else {"start": pos, "end": pos + len(f.quote)})  # fmt: skip
            pos += len(f.quote) + 2
            fid = conn.execute(
                "insert into public.findings (org_id, version_id, run_id, dimension, rule_id, "
                "fact_id, quote, span, severity, confidence, source, explanation, status, "
                "dismiss_reason, resolved_by, resolved_at, model_version, prompt_version, "
                "created_at) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
                "%s, %s, %s, %s, %s) returning id",
                (d.ORG_ID, version_id, run_id, f.dimension,
                 None if f.fact else ids[f.code], facts[f.code] if f.fact else None,
                 f.quote, Jsonb(span), f.severity, f.confidence, f.source,
                 f"Simulated finding citing {f.code}.", f.status, f.dismiss_reason,
                 None if f.status == "open" else CREATOR,
                 None if f.status == "open" else ran + timedelta(hours=1),
                 "simulated" if f.source == "llm" else None,
                 "review@1" if f.source == "llm" else None, ran),
            ).fetchone()[0]  # fmt: skip
            if f.status == "open" and first_open is None:
                first_open = str(fid)
        if c.decision:
            conn.execute(
                "insert into public.decisions (org_id, version_id, actor_id, action, reason, "
                "created_at) values (%s, %s, %s, %s, %s, %s)",
                (d.ORG_ID, version_id, MANAGER, c.decision, c.reason, c.decided),
            )
            if c.override and first_open and c.findings[0].severity == "warning":
                conn.execute(
                    "insert into public.decisions (org_id, version_id, actor_id, action, "
                    "finding_id, reason, created_at) values (%s, %s, %s, 'override', %s, %s, %s)",
                    (d.ORG_ID, version_id, MANAGER, first_open,
                     "Fine for this audience.", c.decided),
                )  # fmt: skip
        conn.execute(
            "insert into public.audit_events (org_id, actor_id, event, at) values (%s, null, %s, %s)",
            (d.ORG_ID, Jsonb({"type": "simulated_activity", "simulated": True,
                              "content_id": str(content_id)}), c.created),
        )  # fmt: skip
        conn.execute(
            "select private.apply_transition(%s, 'archived', 'Simulated history', %s, false)",
            (content_id, MANAGER),
        )


def main() -> int:
    import psycopg
    from psycopg.rows import tuple_row

    parser = argparse.ArgumentParser()
    parser.add_argument("--yes", action="store_true", help="confirm writing to DATABASE_URL")
    parser.add_argument("--seed", type=int, default=26)
    args = parser.parse_args()
    url = os.environ.get("DATABASE_URL")
    if not url or not args.yes:
        print("Set DATABASE_URL and pass --yes (use `make simulate-activity`).", file=sys.stderr)
        return 2
    now = datetime.now(UTC)
    contents = plan(now, args.seed)
    with psycopg.connect(url, row_factory=tuple_row) as conn:
        with conn.transaction():
            apply(conn, contents)
        flagged = conn.execute(
            "select code, gcs from public.flag_unclear_rules(%s)", (d.ORG_ID,)
        ).fetchall()
        conn.commit()
        rows = conn.execute(
            "select code, version, n, gcs, status from public.rule_gcs(%s) where n > 0 "
            "order by n desc",
            (d.ORG_ID,),
        ).fetchall()
    print(f"{len(contents)} simulated contents written (all archived).")
    print("expected (N, GCS):", expected_gcs(contents))
    for code, version, n, gcs, status in rows:
        print(f"  {code} v{version}: N={n} GCS={gcs} {status}")
    print("flagged UNCLEAR:", flagged or "none (already flagged or nothing unclear)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
