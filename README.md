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

### 1. Prerequisites

- Bun 1.3+

### 2. Choose a Mode

- `single` (default): SQLite + local WAL, optimized for single-node installs.
- `scale`: Postgres + partitioned WAL listeners, optimized for higher ingest rates.

### 3. Environment

Required:

- `PORT` (default `3000`)
- `BETTER_AUTH_SECRET` (minimum 32 chars)
- `BETTER_AUTH_URL` (public base URL, e.g. `http://localhost:3000`)

Optional:

- `PULSE_MODE` (`single` | `scale`, default `single`)
- `DATABASE_PATH` (default `.data/pulse.db`)
- `DATABASE_URL` (required for `scale`, e.g. `postgresql://pulse:pulse@localhost:5432/pulse`)
- `NODE_ENV` (`development` | `test` | `production`)
- `ADMIN_KEY` (legacy/internal use)
- `TRACE_WAL_PARTITIONS` (default `1` in `single`, `4` in `scale`)
- `SPAN_WAL_PARTITIONS` (default `1` in `single`, `4` in `scale`)

Example (local):

```bash
export DATABASE_PATH=.data/pulse.db
export PORT=3000
export BETTER_AUTH_SECRET='replace-with-32+char-secret'
export BETTER_AUTH_URL='http://localhost:3000'
```

Scale mode example:

```bash
export PULSE_MODE=scale
export DATABASE_URL='postgresql://pulse:pulse@localhost:5432/pulse'
export PORT=3000
export BETTER_AUTH_SECRET='replace-with-32+char-secret'
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

Service health:

```bash
curl http://localhost:3000/health
```

### 6. Build Executables

```bash
bun run build:pulse
bun run build:pulse-scale
```

Artifacts:

- `dist/pulse` (single mode)
- `dist/pulse-scale` (scale mode)

## Docker (quick start)

From `trace-service/`:

```bash
docker compose up --build
```

This starts trace-service (with local SQLite at `.data/pulse.db`) on `http://localhost:3000`. Run the dashboard separately from `../pulse-dashboard`.

## SDK usage

Create an API key in the dashboard (**API Keys** page), then initialize the SDK in your app.

### 1) Install

```bash
bun add @pulse/sdk openai
```

### 2) Initialize and wrap your client

```ts
import OpenAI from "openai";
import { initPulse, observe, Provider } from "@pulse/sdk";

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
import { observe, Provider } from "@pulse/sdk";

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
