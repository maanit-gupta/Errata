# BrandLens — single entry point. See CLAUDE.md "Commands".
SHELL := /bin/bash
.DEFAULT_GOAL := help

WEB    := apps/web
WORKER := apps/worker
UV     := cd $(WORKER) && uv run

.PHONY: help setup db-start db-stop db-reset db-new types dev dev-local dev-web dev-web-local dev-worker \
        models test test-worker test-web test-db e2e lint lint-worker lint-web fmt check eval eval-vision eval-pdf seed-demo seed-assets-local

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

setup: ## Install everything (pnpm i, uv sync)
	pnpm install
	cd $(WORKER) && uv sync

# --- Database (local Supabase; Docker required) ------------------------------
db-start: ## Start local Supabase
	supabase start

db-stop: ## Stop local Supabase
	supabase stop

db-reset: ## Re-apply all migrations and seed.sql locally
	supabase db reset

db-new: ## New migration: make db-new name=x
	@test -n "$(name)" || { echo "usage: make db-new name=<snake_case>"; exit 1; }
	supabase migration new $(name)

types: ## Regenerate apps/web/types/database.ts from the local DB
	@mkdir -p $(WEB)/types
	supabase gen types typescript --local > $(WEB)/types/database.ts

# --- Dev ---------------------------------------------------------------------
dev: ## Web on :3000 and worker on :8000
	@$(MAKE) -j2 --no-print-directory dev-web dev-worker

dev-web: ## Web only (:3000)
	cd $(WEB) && pnpm dev

dev-local: ## Like make dev, but against the local Supabase stack (make db-start)
	@eval "$$(scripts/local-supabase-env.sh)" && $(MAKE) -j2 --no-print-directory dev-web dev-worker

dev-web-local: ## Web only, against the local Supabase stack
	@eval "$$(scripts/local-supabase-env.sh)" && $(MAKE) --no-print-directory dev-web

dev-worker: ## Worker only (:8000)
	$(UV) uvicorn --factory brandlens_worker.main:create_app --reload --reload-dir brandlens_worker --port 8000

models: ## Download the embedding model into apps/worker/.models (baked into the Docker image)
	$(UV) python -c "from brandlens_worker.embeddings import Embedder; print(Embedder('BAAI/bge-small-en-v1.5', '.models').embed(['warm-up']).shape)"

# --- Quality -----------------------------------------------------------------
test: test-worker test-web test-db ## pytest + Vitest + pgTAP

test-worker:
	$(UV) pytest -q

test-web:
	cd $(WEB) && pnpm test

test-db: ## pgTAP on a freshly reset local DB (tests assume seed.sql state)
	supabase db reset
	supabase test db

e2e: ## Playwright core-loop test (needs make dev)
	@if compgen -G "$(WEB)/e2e/*.spec.ts" > /dev/null; then cd $(WEB) && pnpm e2e; \
	else echo "e2e: not implemented until P10"; fi

lint: lint-worker lint-web ## ruff, mypy, ESLint, Prettier, tsc --noEmit

lint-worker:
	$(UV) ruff check . ../../scripts
	$(UV) ruff format --check . ../../scripts
	$(UV) mypy

lint-web:
	cd $(WEB) && pnpm lint
	cd $(WEB) && pnpm format:check
	cd $(WEB) && pnpm typecheck

fmt: ## Auto-format and auto-fix
	$(UV) ruff check --fix . ../../scripts
	$(UV) ruff format . ../../scripts
	cd $(WEB) && pnpm format

check: lint test ## lint + types + test. Must be green to finish a phase.

# --- Later phases ------------------------------------------------------------
eval: ## Golden-set eval (P14)
	@echo "eval: not implemented until P14 (vision: make eval-vision)"

eval-vision: ## P11 vision eval on the labelled creatives → apps/worker/eval/vision_report.md
	$(UV) python eval/vision_eval.py

eval-pdf: ## P12 PDF eval: fixture deck labels + 40-page benchmark → apps/worker/eval/pdf_report.md
	$(UV) python eval/pdf_eval.py

seed-demo: ## Load the PayWise demo into the cloud project: make seed-demo url=https://<ref>.supabase.co
	@test -n "$(url)" || { echo "usage: make seed-demo url=<SUPABASE_URL>  (must match apps/worker/.env; local uses make db-reset)"; exit 1; }
	$(UV) python ../../scripts/seed_demo.py --url "$(url)" --yes

seed-assets-local: ## Upload the PayWise logo files to the LOCAL stack's Storage (after db-reset)
	@eval "$$(scripts/local-supabase-env.sh)" && $(UV) python ../../scripts/seed_demo.py --url "$$SUPABASE_URL" --yes --logos-only
