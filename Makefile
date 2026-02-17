.PHONY: install dev up down down-v logs db-up db-down migrate migrate-gen migrate-push studio seed test test-e2e test-watch clean

db-up:
	docker compose up -d postgres

db-down:
	docker compose stop postgres

install:
	bun install

# Local development (Postgres + app)
dev: db-up migrate
	bun run index.ts

# Full stack in Docker (postgres + trace-service)
up:
	docker compose up --build

down:
	docker compose down

# stop and remove volumes ( reset database )
down-v:
	docker compose down -v

logs:
	docker compose logs -f postgres trace-service

migrate: db-up
	bun run db:migrate

migrate-gen:
	bun run db:generate

migrate-push: db-up
	bun run db:push

studio:
	bun run db:studio

seed:
	bun run db:seed

test:
	bun test --env-file=.env.test

# Integration tests against local service on :3000.
# This target starts postgres + app, waits for health, runs tests, and cleans up.
test-e2e:
	@set -e; \
	docker compose up -d postgres; \
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
