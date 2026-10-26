#!/usr/bin/env bash
# Print `export` lines that point the web app and worker at the LOCAL Supabase stack
# (`make db-start`), overriding the cloud values in .env files for one process only.
# Usage: eval "$(scripts/local-supabase-env.sh)"   — values are never echoed to the terminal.
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|DB_URL)=')"
cat <<OUT
export NEXT_PUBLIC_SUPABASE_URL='${API_URL}'
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='${PUBLISHABLE_KEY}'
export SUPABASE_URL='${API_URL}'
export SUPABASE_SECRET_KEY='${SECRET_KEY}'
export DATABASE_URL='${DB_URL}'
export NEXT_PUBLIC_DEMO_MODE='true'
OUT
