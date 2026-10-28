#!/usr/bin/env bash
# Print `export` lines that point the web app and worker at the LOCAL Supabase stack
# (`make db-start`), overriding the cloud values in .env files for one process only.
# Usage: eval "$(scripts/local-supabase-env.sh)"   — values are never echoed to the terminal.
#
# Machines without apps/web/.env.local (a fresh clone) still need the two web settings that
# have no local service behind them, so they get local defaults: the site URL, and a webhook
# address that refuses connections (notifications are logged as failed, never sent). Only the
# key *names* in .env.local are checked; values are never read.
set -euo pipefail
SUPABASE="${SUPABASE:-$(command -v supabase >/dev/null 2>&1 && echo supabase || echo "npx --yes supabase@2")}"
eval "$($SUPABASE status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|DB_URL)=')"
if [ -z "${API_URL:-}" ]; then
  echo "echo 'Local Supabase is not running. Start it with: make db-start' >&2; false"
  exit 0
fi
WEB_ENV="$(dirname "$0")/../apps/web/.env.local"
has_key() { [ -f "$WEB_ENV" ] && grep -Eq "^$1=.+" "$WEB_ENV"; }
cat <<OUT
export NEXT_PUBLIC_SUPABASE_URL='${API_URL}'
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='${PUBLISHABLE_KEY}'
export SUPABASE_URL='${API_URL}'
export SUPABASE_SECRET_KEY='${SECRET_KEY}'
export DATABASE_URL='${DB_URL}'
export NEXT_PUBLIC_DEMO_MODE='true'
OUT
has_key NEXT_PUBLIC_SITE_URL || echo "export NEXT_PUBLIC_SITE_URL='http://localhost:3000'"
has_key DISCORD_WEBHOOK_URL || echo "export DISCORD_WEBHOOK_URL='http://127.0.0.1:9/discord-disabled'"
