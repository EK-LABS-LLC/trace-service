# Pulse Trace Service

Backend + dashboard for LLM observability.

- Ingest traces with API keys (`/v1/*`)
- Manage projects and API keys via authenticated dashboard user sessions (`/dashboard/api/*`)
- Better Auth handles account/session endpoints (`/api/auth/*`)

## Architecture

### Data plane (SDK/API key)
Use these from servers, workers, apps, and scripts:

- `POST /v1/traces/batch`
- `GET /v1/traces`
- `GET /v1/traces/:id`
- `GET /v1/sessions/:id`
- `GET /v1/analytics`

Auth: `Authorization: Bearer <pulse_sk_...>`

### Control plane (Dashboard/user session)
Use these from the dashboard UI:

- `POST /dashboard/api/signup` (public account + first project bootstrap)
- `GET /dashboard/api/projects`
- `POST /dashboard/api/projects`
- `GET /dashboard/api/api-keys`
- `DELETE /dashboard/api/api-keys/:id`
- GET/POST project-scoped dashboard data routes (require `X-Project-Id`)

Auth: Better Auth session cookie (`better-auth.session_token`)

## Self-hosting

Operational runbooks live in `docs/operations.md`.

### 1. Prerequisites

- Bun 1.3+

### 2. Choose a Mode

- `single` (default): SQLite + local WAL, optimized for single-node installs.
- `scale`: Postgres + partitioned WAL listeners, optimized for higher ingest rates.

### 3. Environment

Required:

- `PORT` (default `3000`)
- `BETTER_AUTH_SECRET` (minimum 32 chars, signs dashboard auth sessions/cookies)
- `ENCRYPTION_KEY` (minimum 32 chars, encrypts stored API keys at rest)
- `BETTER_AUTH_URL` (public base URL used by auth/session flows, e.g. `http://localhost:3000`)

Optional:

- `PULSE_MODE` (`single` | `scale`, default `single`)
- `PULSE_RUNTIME_MODE` (`all` | `api` | `listener`, default `all`)
- `PULSE_HOME` (default `~/.pulse`)
- `PULSE_DATA_DIR` (default `~/.pulse/.data`)
- `DATABASE_PATH` (default `~/.pulse/.data/pulse.db`)
- `DATABASE_URL` (required for `scale`, e.g. `postgresql://pulse:pulse@localhost:5432/pulse`)
- `NODE_ENV` (`development` | `test` | `production`)
- `ADMIN_KEY` (legacy/internal use)
- `TRACE_WAL_PARTITIONS` (default `1` in `single`, `4` in `scale`)
- `SPAN_WAL_PARTITIONS` (default `1` in `single`, `4` in `scale`)

Example (local):

```bash
export PORT=3000
# 32+ chars for signing dashboard sessions/cookies
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
# 32+ chars for encrypting API keys at rest
export ENCRYPTION_KEY="$(openssl rand -hex 32)"
# Public URL clients use to reach this service
export BETTER_AUTH_URL='http://localhost:3000'
```

Scale mode example:

```bash
export PULSE_MODE=scale
export DATABASE_URL='postgresql://pulse:pulse@localhost:5432/pulse'
export PORT=3000
# 32+ chars for signing dashboard sessions/cookies
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
# 32+ chars for encrypting API keys at rest
export ENCRYPTION_KEY="$(openssl rand -hex 32)"
# Public URL clients use to reach this service
export BETTER_AUTH_URL='http://localhost:3000'
```

### 4. Install + migrate

```bash
bun install
bun run db:migrate
```

For `scale` mode:

```bash
bun run db:migrate:scale
```

### 5. Start service

```bash
bun run dev:single
```

Scale mode:

```bash
bun run dev:scale
```

Split API and listeners into separate processes:

```bash
# API process only
PULSE_RUNTIME_MODE=api bun run dev:scale

# Listener process only
PULSE_RUNTIME_MODE=listener bun run dev:scale
```

Service health:

```bash
curl http://localhost:3000/health
```

### 6. Build Executables

```bash
bun run build:pulse
```

Artifacts:

- `dist/pulse-server` (single or scale mode via `PULSE_MODE`)

### 7. Publish Release Artifacts

Tag and push a version:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

This triggers `.github/workflows/release.yml`, which builds and publishes:

- `pulse-server-linux-amd64`
- `pulse-server-linux-arm64`
- `pulse-server-darwin-amd64`
- `pulse-server-darwin-arm64`
- `checksums.txt`

You can also run the release workflow manually from GitHub Actions.

### 8. Install Binaries (Server + CLI)

Install latest `pulse-server` and `pulse` CLI together:

```bash
curl -fsSL https://raw.githubusercontent.com/EK-LABS-LLC/trace-service/main/scripts/install.sh | bash -s -- pulse-server
```

Install a specific tag:

```bash
curl -fsSL https://raw.githubusercontent.com/EK-LABS-LLC/trace-service/main/scripts/install.sh | bash -s -- pulse-server --version vX.Y.Z
```

Install server only (skip CLI):

```bash
curl -fsSL https://raw.githubusercontent.com/EK-LABS-LLC/trace-service/main/scripts/install.sh | bash -s -- pulse-server --server-only
```

Run installed binary in scale mode:

```bash
export PULSE_MODE=scale
export DATABASE_URL='postgresql://pulse:pulse@localhost:5432/pulse'
pulse-server
```

### 9. Uninstall (Server + CLI)

Remove installed binaries from `~/.local/bin` and clean agent hooks:

```bash
curl -fsSL https://raw.githubusercontent.com/EK-LABS-LLC/trace-service/main/scripts/uninstall.sh | bash
```

Full cleanup (also removes `~/.pulse` config/data):

```bash
curl -fsSL https://raw.githubusercontent.com/EK-LABS-LLC/trace-service/main/scripts/uninstall.sh | bash -s -- --purge-data
```

### 10. Docker Image (Server)

Pull and run server image:

```bash
docker run --rm -p 3000:3000 \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e BETTER_AUTH_URL='http://localhost:3000' \
  ghcr.io/ek-labs-llc/pulse-server:<tag>
```

Scale mode with Postgres:

```bash
docker run --rm -p 3000:3000 \
  -e PULSE_MODE=scale \
  -e DATABASE_URL='postgresql://pulse:pulse@host.docker.internal:5432/pulse' \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e BETTER_AUTH_URL='http://localhost:3000' \
  ghcr.io/ek-labs-llc/pulse-server:<tag>
```

On tag push (`v*`), `.github/workflows/release-image.yml` publishes multi-arch images:

- `ghcr.io/ek-labs-llc/pulse-server:vX.Y.Z`
- `ghcr.io/ek-labs-llc/pulse-server:sha-...`

## Local Postgres Helper (Scale Mode)

For scale-mode tests/dev, start only Postgres:

```bash
make up
make test-e2e-scale
make down
```

Equivalent explicit commands:

```bash
make scale-up
make test-e2e-scale
make scale-down
```

## SDK usage

Create an API key in the dashboard (**API Keys** page), then initialize the SDK in your app.

### 1) Install

```bash
bun add @eklabs/pulse-sdk openai
```

### 2) Initialize and wrap your client

```ts
import OpenAI from "openai";
import { initPulse, observe, Provider } from "@eklabs/pulse-sdk";

initPulse({
  apiKey: process.env.PULSE_API_KEY!,        // pulse_sk_...
  apiUrl: process.env.PULSE_API_URL || "http://localhost:3000",
  batchSize: 10,
  flushInterval: 5000,
});

const openai = observe(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  Provider.OpenAI,
);

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

### 3) Optional session + metadata tagging per request

```ts
await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Summarize this" }],
  pulseSessionId: "session-123",
  pulseMetadata: { userId: "user-42", feature: "chat" },
});
```

### 4) Anthropic example

```ts
import Anthropic from "@anthropic-ai/sdk";
import { observe, Provider } from "@eklabs/pulse-sdk";

const anthropic = observe(
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  Provider.Anthropic,
);
```

## Raw API (optional)

If you are not using the SDK, send traces directly to:

- `POST /v1/traces/batch` with `Authorization: Bearer pulse_sk_...`

## Security model

- Dashboard routes are secure by session cookie + server-side project membership checks.
- SDK routes are secure by project API key.
- Changing `X-Project-Id` on client does not bypass authorization; server validates access in DB.

## Tests

Tests are integration-oriented and assume service is reachable at `http://localhost:3000`.

```bash
bun test --env-file=.env.test
```

End-to-end harness (starts service automatically):

```bash
make test-e2e
make test-e2e-scale
```
