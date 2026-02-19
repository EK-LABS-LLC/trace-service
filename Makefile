.PHONY: install dev dev-scale up down down-v logs db-up db-down scale-up scale-down migrate migrate-scale migrate-gen migrate-push studio seed seed-existing-project seed-with-api-key test test-e2e test-e2e-scale test-watch build build-scale release-artifacts clean

SCALE_DATABASE_PORT ?= 55433
SCALE_DATABASE_URL ?= postgresql://pulse:pulse@localhost:$(SCALE_DATABASE_PORT)/pulse

db-up:
	@echo "SQLite backend enabled; no external DB to start."

db-down:
	@echo "SQLite backend enabled; no external DB to stop."

scale-up:
	PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml up -d postgres

scale-down:
	PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml down -v

install:
	bun install

# Local development (SQLite + app)
dev: migrate
	bun run pulse.ts

# Scale mode (Postgres + partitioned listeners)
dev-scale:
	PULSE_MODE=scale bun run pulse-scale.ts

# Full stack in Docker (trace-service only)
up:
	docker compose up --build

down:
	docker compose down

# stop and remove volumes ( reset database )
down-v:
	docker compose down -v

logs:
	docker compose logs -f trace-service

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

# Integration tests against local service on :3000.
# This target starts the app, waits for health, runs tests, and cleans up.
test-e2e:
	@set -e; \
	DATABASE_PATH=.data/pulse.test.db WAL_DIR=.data/wal.test WAL_SPAN_DIR=.data/wal-spans.test bun run db:migrate; \
	rm -rf .data/wal.test .data/wal-spans.test .data/pulse.test.db-shm .data/pulse.test.db-wal; \
	DATABASE_PATH=.data/pulse.test.db WAL_DIR=.data/wal.test WAL_SPAN_DIR=.data/wal-spans.test TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 bun run pulse.ts > /tmp/trace-service-test.log 2>&1 & \
	PID=$$!; \
	trap 'kill $$PID 2>/dev/null || true; wait $$PID 2>/dev/null || true' EXIT; \
	for i in $$(seq 1 40); do \
		if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.5; \
		if [ $$i -eq 40 ]; then \
			echo "Service failed to become healthy. Last logs:"; \
			tail -n 120 /tmp/trace-service-test.log || true; \
			exit 1; \
		fi; \
	done; \
	bun test --env-file=.env.test

test-watch:
	bun test --watch --env-file=.env.test

build:
	bun run build:pulse

build-scale:
	bun run build:pulse-scale

release-artifacts:
	bun run release:artifacts

test-e2e-scale:
	@set -e; \
	PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml up -d postgres; \
	PID=""; \
	trap 'if [ -n "$$PID" ]; then kill $$PID 2>/dev/null || true; wait $$PID 2>/dev/null || true; fi; PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml down -v >/dev/null 2>&1 || true' EXIT; \
	for i in $$(seq 1 60); do \
		if PULSE_SCALE_PG_PORT=$(SCALE_DATABASE_PORT) docker compose -f docker-compose.scale.yml exec -T postgres pg_isready -U pulse -d pulse >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 1; \
		if [ $$i -eq 60 ]; then \
			echo "Postgres failed to become ready"; \
			exit 1; \
		fi; \
	done; \
	PULSE_MODE=scale DATABASE_URL='$(SCALE_DATABASE_URL)' bun run db:migrate:scale; \
	rm -rf .data/wal.test .data/wal-spans.test; \
	PULSE_MODE=scale DATABASE_URL='$(SCALE_DATABASE_URL)' WAL_DIR=.data/wal.test WAL_SPAN_DIR=.data/wal-spans.test TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 bun run pulse-scale.ts > /tmp/trace-service-scale-test.log 2>&1 & \
	PID=$$!; \
	for i in $$(seq 1 40); do \
		if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.5; \
		if [ $$i -eq 40 ]; then \
			echo "Scale service failed to become healthy. Last logs:"; \
			tail -n 120 /tmp/trace-service-scale-test.log || true; \
			exit 1; \
		fi; \
	done; \
	bun test --env-file=.env.test

clean:
	rm -rf node_modules
