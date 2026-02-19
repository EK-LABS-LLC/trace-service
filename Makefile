.PHONY: install dev up down down-v logs db-up db-down migrate migrate-gen migrate-push studio seed seed-existing-project seed-with-api-key test test-e2e test-watch clean

db-up:
	@echo "SQLite backend enabled; no external DB to start."

db-down:
	@echo "SQLite backend enabled; no external DB to stop."

install:
	bun install

# Local development (SQLite + app)
dev: migrate
	bun run index.ts

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
	bun run db:migrate; \
	bun run index.ts > /tmp/trace-service-test.log 2>&1 & \
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

clean:
	rm -rf node_modules
