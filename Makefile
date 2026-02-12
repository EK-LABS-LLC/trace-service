.PHONY: dev up down logs migrate studio clean seed test

# Local development
dev:
	bun run index.ts

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
	bun run db:seed

test:
	bun test --env-file=.env.test

test-watch:
	bun test --watch --env-file=.env.test

install:
	bun install

clean:
	rm -rf node_modules
