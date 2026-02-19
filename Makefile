.PHONY: install dev dev-api dev-listener dev-scale dev-scale-api dev-scale-listener up down scale-up scale-down migrate migrate-scale migrate-gen migrate-push studio seed seed-existing-project seed-with-api-key test test-e2e test-e2e-split test-e2e-scale test-e2e-scale-split test-watch build build-scale release-artifacts clean

SCALE_DATABASE_PORT ?= 55433
SCALE_DATABASE_URL ?= postgresql://pulse:pulse@localhost:$(SCALE_DATABASE_PORT)/pulse
E2E_SCRIPT := ./scripts/run-e2e.sh

scale-up:
	PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml up -d postgres

scale-down:
	PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml down -v

install:
	bun install

# Local development (SQLite + app)
dev: migrate
	bun run pulse.ts

# Local development (SQLite + API only)
dev-api: migrate
	PULSE_RUNTIME_MODE=api bun run pulse.ts

# Local development (SQLite + listeners only)
dev-listener:
	PULSE_RUNTIME_MODE=listener bun run pulse.ts

# Scale mode (Postgres + partitioned listeners)
dev-scale:
	PULSE_MODE=scale bun run pulse-scale.ts

# Scale mode API only (no listeners)
dev-scale-api:
	PULSE_MODE=scale PULSE_RUNTIME_MODE=api bun run pulse-scale.ts

# Scale mode listeners only (no API)
dev-scale-listener:
	PULSE_MODE=scale PULSE_RUNTIME_MODE=listener bun run pulse-scale.ts

# Backward-compatible aliases for local scale Postgres helper
up:
	$(MAKE) scale-up

down:
	$(MAKE) scale-down

migrate:
	bun run db:migrate

migrate-scale:
	PULSE_MODE=scale bun run db:migrate:scale

migrate-gen:
	bun run db:generate

migrate-push:
	bun run db:push

studio:
	bun run db:studio

seed:
	@test -n "$(SEED_EMAIL)" || (echo "SEED_EMAIL is required"; exit 1)
	@test -n "$(SEED_PASSWORD)" || (echo "SEED_PASSWORD is required"; exit 1)
	SEED_BASE_URL=$${SEED_BASE_URL:-http://localhost:3000} \
	SEED_EMAIL=$(SEED_EMAIL) \
	SEED_PASSWORD=$(SEED_PASSWORD) \
	SEED_NAME="$${SEED_NAME:-Seed User}" \
	SEED_PROJECT_NAME="$${SEED_PROJECT_NAME:-Seed Project}" \
	SEED_SESSIONS=$${SEED_SESSIONS:-50} \
	SEED_TRACES_PER_SESSION=$${SEED_TRACES_PER_SESSION:-20} \
	SEED_SPANS_PER_SESSION=$${SEED_SPANS_PER_SESSION:-30} \
	SEED_DAYS_BACK=$${SEED_DAYS_BACK:-14} \
	bun run scripts/seed.ts

# Seed an existing project id (signs in with dashboard user and fetches/creates API key)
seed-existing-project:
	@test -n "$(SEED_PROJECT_ID)" || (echo "SEED_PROJECT_ID is required"; exit 1)
	@test -n "$(SEED_EMAIL)" || (echo "SEED_EMAIL is required"; exit 1)
	@test -n "$(SEED_PASSWORD)" || (echo "SEED_PASSWORD is required"; exit 1)
	SEED_BASE_URL=$${SEED_BASE_URL:-http://localhost:3000} \
	SEED_EMAIL=$(SEED_EMAIL) \
	SEED_PASSWORD=$(SEED_PASSWORD) \
	SEED_PROJECT_ID=$(SEED_PROJECT_ID) \
	SEED_SESSIONS=$${SEED_SESSIONS:-50} \
	SEED_TRACES_PER_SESSION=$${SEED_TRACES_PER_SESSION:-20} \
	SEED_SPANS_PER_SESSION=$${SEED_SPANS_PER_SESSION:-30} \
	SEED_DAYS_BACK=$${SEED_DAYS_BACK:-14} \
	bun run scripts/seed.ts

# Seed using direct project id + API key (no dashboard user/session needed)
seed-with-api-key:
	@test -n "$(SEED_PROJECT_ID)" || (echo "SEED_PROJECT_ID is required"; exit 1)
	@test -n "$(SEED_API_KEY)" || (echo "SEED_API_KEY is required"; exit 1)
	SEED_BASE_URL=$${SEED_BASE_URL:-http://localhost:3000} \
	SEED_PROJECT_ID=$(SEED_PROJECT_ID) \
	SEED_API_KEY=$(SEED_API_KEY) \
	SEED_SESSIONS=$${SEED_SESSIONS:-50} \
	SEED_TRACES_PER_SESSION=$${SEED_TRACES_PER_SESSION:-20} \
	SEED_SPANS_PER_SESSION=$${SEED_SPANS_PER_SESSION:-30} \
	SEED_DAYS_BACK=$${SEED_DAYS_BACK:-14} \
	bun run scripts/seed.ts

test:
	bun test --env-file=.env.test

test-e2e:
	$(E2E_SCRIPT) single

test-e2e-split:
	SPLIT=1 $(E2E_SCRIPT) single

test-watch:
	bun test --watch --env-file=.env.test

build:
	bun run build:pulse

build-scale:
	bun run build:pulse-scale

release-artifacts:
	bun run release:artifacts

test-e2e-scale:
	$(E2E_SCRIPT) scale

test-e2e-scale-split:
	SPLIT=1 $(E2E_SCRIPT) scale

clean:
	rm -rf node_modules
