#!/usr/bin/env bash
# P16: reset the PayWise demo org to a known state before live judging.
#   scripts/reset_demo.sh <SUPABASE_URL> --yes
# The URL must equal SUPABASE_URL in apps/worker/.env (the DB it writes to is that file's
# DATABASE_URL). Steps: clear every content and roll rule cards back to v1 (scripts/sql/
# reset_demo.sql), re-seed anything missing (users, vault, logos), then re-simulate 30 days of
# illustrative history so /insights shows TV-04 UNCLEAR with its suggested examples pending.
set -euo pipefail
cd "$(dirname "$0")/../apps/worker"

url="${1:-}"
if [[ -z "$url" || "${2:-}" != "--yes" ]]; then
  echo "usage: scripts/reset_demo.sh <SUPABASE_URL> --yes   (deletes every PayWise draft)" >&2
  exit 2
fi
set -a; . ./.env; set +a
norm() { echo "$1" | tr 'A-Z' 'a-z' | sed 's:/*$::'; }
if [[ "$(norm "$url")" != "$(norm "$SUPABASE_URL")" ]]; then
  echo "url does not match SUPABASE_URL in apps/worker/.env; refusing." >&2
  exit 1
fi

echo "1/3 clearing contents and restoring rule cards…"
uv run python - <<'PY'
import os, psycopg
sql = open("../../scripts/sql/reset_demo.sql").read()
with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    conn.execute(sql)
    n = conn.execute("select count(*) from public.contents where org_id = %s",
                     ("00000000-0000-4000-8000-0000000000a1",)).fetchone()[0]
print(f"   contents left: {n}")
PY

echo "2/3 re-seeding missing rows…"
uv run python ../../scripts/seed_demo.py --url "$url" --yes

echo "3/3 simulating 30 days of activity…"
uv run python ../../scripts/simulate_activity.py --yes

echo "Done. Sign in at the deployed URL with a demo role (README → Demo)."
