# BrandLens — single entry point. See CLAUDE.md "Commands".
SHELL := /bin/bash
.DEFAULT_GOAL := help

WEB    := apps/web
WORKER := apps/worker
UV     := cd $(WORKER) && uv run

.PHONY: help setup db-start db-stop db-reset db-new types dev dev-web dev-worker \
        test test-worker test-web test-db e2e lint lint-worker lint-web fmt check eval seed-demo

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

dev-worker: ## Worker only (:8000)
	$(UV) uvicorn --factory brandlens_worker.main:create_app --reload --reload-dir brandlens_worker --port 8000

# --- Quality -----------------------------------------------------------------
test: test-worker test-web test-db ## pytest + Vitest + pgTAP

test-worker:
	$(UV) pytest -q

test-web:
	cd $(WEB) && pnpm test

test-db:
	@if compgen -G "supabase/tests/*.sql" > /dev/null; then supabase test db; \
	else echo "test-db: no pgTAP tests yet (added in P01)"; fi

e2e: ## Playwright core-loop test (needs make dev)
	@if compgen -G "$(WEB)/e2e/*.spec.ts" > /dev/null; then cd $(WEB) && pnpm e2e; \
	else echo "e2e: not implemented until P10"; fi

lint: lint-worker lint-web ## ruff, mypy, ESLint, Prettier, tsc --noEmit

lint-worker:
	$(UV) ruff check .
	$(UV) ruff format --check .
	$(UV) mypy

lint-web:
	cd $(WEB) && pnpm lint
	cd $(WEB) && pnpm format:check
	cd $(WEB) && pnpm typecheck

fmt: ## Auto-format and auto-fix
	$(UV) ruff check --fix .
	$(UV) ruff format .
	cd $(WEB) && pnpm format

check: lint test ## lint + types + test. Must be green to finish a phase.

# --- Later phases ------------------------------------------------------------
eval: ## Golden-set eval (P14)
	@echo "eval: not implemented until P14"

seed-demo: ## Load the PayWise demo into the current Supabase target (P01/P04)
	@echo "seed-demo: not implemented until P01"
