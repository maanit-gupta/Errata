#!/usr/bin/env bash
# Print `export` lines that point the web app and worker at the LOCAL Supabase stack
# (`make db-start`), overriding the cloud values in .env files for one process only.
# Usage: eval "$(scripts/local-supabase-env.sh)"   — values are never echoed to the terminal.
#
# Machines without apps/web/.env.local (a fresh clone) still need the two web settings that
# have no local service behind them, so they get local defaults: the site URL, and a webhook
# address that refuses connections (notifications are logged as failed, never sent). Only the
# key *names* in .env.local are checked; values are never read.
#
# Without apps/worker/.env the worker gets placeholder LLM and tracing settings: every LLM call
# fails, so reviews finish in degraded mode (deterministic findings only, flagged in the UI),
# and nothing is sent to Groq, Gemini or Langfuse.
set -euo pipefail
SUPABASE="${SUPABASE:-$(command -v supabase >/dev/null 2>&1 && echo supabase || echo "npx --yes supabase@2")}"
eval "$($SUPABASE status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|DB_URL)=')"
if [ -z "${API_URL:-}" ]; then
  echo "echo 'Local Supabase is not running. Start it with: make db-start' >&2; false"
  exit 0
fi
WEB_ENV="$(dirname "$0")/../apps/web/.env.local"
WORKER_ENV="$(dirname "$0")/../apps/worker/.env"
has_key() { [ -f "$WEB_ENV" ] && grep -Eq "^$1=.+" "$WEB_ENV"; }
worker_has() { [ -f "$WORKER_ENV" ] && grep -Eq "^$1=.+" "$WORKER_ENV"; }
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
# Worker: local placeholders for anything apps/worker/.env doesn't define.
for kv in \
  "PGMQ_QUEUE=review_jobs" \
  "LLM_PROVIDER=groq" \
  "LLM_FALLBACK_PROVIDER=none" \
  "GROQ_API_KEY=local-placeholder-no-llm" \
  "GEMINI_API_KEY=local-placeholder-no-llm" \
  "GROQ_MODEL_TEXT=local-placeholder" \
  "GROQ_MODEL_VISION=local-placeholder" \
  "GEMINI_MODEL_TEXT=local-placeholder" \
  "GEMINI_MODEL_VISION=local-placeholder" \
  "EMBEDDING_MODEL=BAAI/bge-small-en-v1.5" \
  "MODEL_CACHE_DIR=.models" \
  "OCR_ENGINE=tesseract" \
  "LANGFUSE_HOST=http://127.0.0.1:9" \
  "LANGFUSE_PUBLIC_KEY=local-placeholder" \
  "LANGFUSE_SECRET_KEY=local-placeholder" \
  "ENV=local" \
  "SITE_URL=http://localhost:3000"; do
  worker_has "${kv%%=*}" || echo "export ${kv%%=*}='${kv#*=}'"
done
