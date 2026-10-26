"""Load the PayWise demo org, users and vault into a **cloud** Supabase project, idempotently.

Run from the worker venv (it reads apps/worker/.env for SUPABASE_URL and SUPABASE_SECRET_KEY):

    make seed-demo url=https://<ref>.supabase.co

It refuses to run unless --url equals the configured SUPABASE_URL **and** --yes is passed, so it
can't seed the wrong project by accident. Existing rows are left untouched (insert-if-missing),
so re-running never overwrites edits made in the app. Local dev uses `supabase/seed.sql` instead.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

sys.path.insert(0, str(Path(__file__).resolve().parent))
import demo_data as d

WORKER_ENV = Path(__file__).resolve().parents[1] / "apps" / "worker" / ".env"


class SeedSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=WORKER_ENV, extra="ignore", hide_input_in_errors=True
    )

    supabase_url: str
    supabase_secret_key: SecretStr


def _norm(url: str) -> str:
    return url.strip().rstrip("/").lower()


def check_target(url_arg: str, configured: str, yes: bool) -> str | None:
    """Return a refusal message, or None if it is safe to proceed."""
    if _norm(url_arg) != _norm(configured):
        return "--url does not match SUPABASE_URL in apps/worker/.env; refusing to seed."
    if not yes:
        return "pass --yes to confirm seeding demo data into this project."
    return None


def ensure_users(client: Any) -> int:
    existing = {u.email: u.id for u in _all_users(client)}
    created = 0
    for user_id, email, display_name, _role, _kind in d.USERS:
        if email in existing:
            if existing[email] != user_id:
                raise SystemExit(f"{email} exists with a different id; delete it and re-run.")
            continue
        client.auth.admin.create_user(
            {
                "id": user_id,
                "email": email,
                "password": d.DEMO_PASSWORD,
                "email_confirm": True,
                "user_metadata": {"display_name": display_name},
            }
        )
        created += 1
    return created


def _all_users(client: Any) -> list[Any]:
    users: list[Any] = []
    page = 1
    while True:
        batch = client.auth.admin.list_users(page=page, per_page=200)
        users.extend(batch)
        if len(batch) < 200:
            return users
        page += 1


def insert_missing(client: Any, table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
    client.table(table).upsert(rows, on_conflict=on_conflict, ignore_duplicates=True).execute()


def seed(client: Any) -> None:
    created = ensure_users(client)
    insert_missing(client, "organisations", [d.ORGANISATION], "id")
    insert_missing(client, "campaigns", d.CAMPAIGNS, "id")
    insert_missing(
        client,
        "memberships",
        [
            {"org_id": d.ORG_ID, "user_id": uid, "role": role, "specialist_kind": kind}
            for uid, _email, _name, role, kind in d.USERS
        ],
        "org_id,user_id",
    )
    insert_missing(client, "glossary_terms", d.GLOSSARY, "org_id,code")
    insert_missing(client, "facts", d.FACTS, "org_id,code")
    insert_missing(
        client,
        "rule_cards",
        [{**card, "org_id": d.ORG_ID, "status": "approved", "version": 1} for card in d.RULE_CARDS],
        "org_id,code,version",
    )
    # The worker's embed_vault job fills embeddings for approved cards and facts (P04).
    client.rpc("enqueue_vault_job", {"p_org": d.ORG_ID, "p_job": "embed_vault"}).execute()
    print(
        f"Seeded PayWise: {created} new user(s), {len(d.CAMPAIGNS)} campaigns, "
        f"{len(d.FACTS)} facts, {len(d.RULE_CARDS)} rule cards (existing rows untouched)."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--url", required=True, help="Must equal SUPABASE_URL in apps/worker/.env")
    parser.add_argument("--yes", action="store_true", help="Confirm seeding this project")
    args = parser.parse_args(argv)

    settings = SeedSettings()  # type: ignore[call-arg]
    refusal = check_target(args.url, settings.supabase_url, args.yes)
    if refusal:
        print(refusal, file=sys.stderr)
        return 2

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_secret_key.get_secret_value())
    seed(client)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
