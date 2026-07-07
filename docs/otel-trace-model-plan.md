# Experimental OTel Trace Model Plan

## Objective

Move Pulse to a clean OpenTelemetry-compatible model across the service, SDKs, CLI, dashboard, and docs:

```text
Pulse Session
  OTel Trace = one request, turn, task, or workflow
    OTel Span = one timed operation inside that trace
```

This branch set proves the model end to end while keeping compatibility adapters in place. The final cleanup phase should remove legacy trace storage only after parity has been reviewed against real data.

## Branches And PRs

All implementation branches are named `experiment/otel-trace-model`.

| Repo | PR | Purpose |
| --- | --- | --- |
| `trace-service` | https://github.com/EK-LABS-LLC/trace-service/pull/14 | OTel ingest, storage, dashboard APIs, dashboard UI, analytics, backfill, compatibility adapters |
| `trace-sdk-ts` | https://github.com/EK-LABS-LLC/trace-sdk-ts/pull/3 | Keep `observe()` while emitting OTLP HTTP JSON |
| `trace-sdk-py` | https://github.com/EK-LABS-LLC/trace-sdk-py/pull/3 | Keep `observe()` while emitting OTLP HTTP JSON |
| `trace-cli` | https://github.com/EK-LABS-LLC/trace-cli/pull/12 | Emit OTel-shaped agent spans and group them into traces |
| `pulse-docs` | https://github.com/EK-LABS-LLC/pulse-docs/pull/5 | Document the OTel trace/span/session model |

`pulse-dashboard` is intentionally untouched. The shipped dashboard is under `trace-service/dashboard`.

## Canonical Model

- Session: Pulse grouping container, usually a conversation, CLI run, or workflow grouping.
- Trace: OTel trace, usually one LLM call, agent turn, task, or workflow.
- Span: one timed operation inside a trace.

Canonical ingest:

```http
POST /v1/traces
Content-Type: application/json
```

The payload is OTLP HTTP JSON:

```text
resourceSpans[]
  resource
  scopeSpans[]
    scope
    spans[]
```

Canonical dashboard/API reads:

- `GET /dashboard/api/sessions`
- `GET /dashboard/api/sessions/:id/traces`
- `GET /dashboard/api/traces/:traceId`
- `GET /dashboard/api/traces/:traceId/spans`

Compatibility reads retained during the migration window:

- `GET /v1/traces`
- `GET /v1/traces/:id`
- `GET /v1/sessions/:id`
- `GET /v1/sessions/:id/spans`
- existing legacy async/batch ingest paths

## Current Implementation State

### Trace Service

- `spans` is the canonical telemetry table for OTel-shaped telemetry.
- `trace_summaries` is a derived query/cache table, not the source of truth.
- OTLP HTTP JSON ingest is implemented at `POST /v1/traces`.
- Legacy SDK trace payloads are converted into one OTel trace with one provider-call span.
- Legacy agent spans are converted into OTel-shaped spans and grouped into traces.
- Agent spans without explicit trace IDs use compatibility grouping:
  - `user_prompt_submit` starts an `agent.turn` trace.
  - assistant/tool/subagent/stop events attach to the active turn.
  - lifecycle-only spans attach to `agent.session_lifecycle`.
- Dashboard-facing reads now use sessions derived from trace summaries, session detail as trace summaries, and trace detail as spans sharing a trace ID.
- Analytics now reads from OTel summaries/spans instead of adding new behavior to the legacy `traces` table.
- An idempotent backfill command exists:

```bash
bun run db:backfill:otel
```

### SDKs

- TypeScript and Python SDKs keep the public `observe()` API.
- Internally, `observe()` emits one OTel trace with one main provider-call span.
- Provider/model/tokens/cost/session/trace/prompt metadata are emitted as OTel and Pulse attributes.
- Pulse-specific attributes remain under `pulse.*`.

### CLI

- Hook emitters for agent harnesses now send OTLP HTTP JSON to `POST /v1/traces`.
- Agent session naming is preserved through `pulse.session.name`.
- Agent events are grouped by turn where possible.
- Lifecycle-only events use a session lifecycle trace.

### Dashboard

- The dashboard product model is now Session -> Traces -> Spans.
- Old product concepts like separate LLM rows vs agent span sessions should not be reintroduced.
- Counts should use `traces` for trace summaries and `spans` for timeline/tree entries.
- Trace rows should prefer human-readable names:
  - `pulse.trace.name`
  - prompt preview
  - agent event title
  - provider/model fallback

## Migration And Backfill

Backfill must remain idempotent.

Existing SDK trace rows should become:

- one OTel trace summary
- one provider-call span
- deterministic OTel trace/span IDs from the legacy trace ID

Existing agent spans should become:

- OTel-shaped spans
- trace grouping inferred from agent turn/session lifecycle compatibility rules
- `pulse.session_id` stored in span attributes

Do not drop legacy tables until:

- backfill parity has been run against representative real data
- SDK and CLI releases have moved current clients to OTLP
- dashboard and analytics parity has been reviewed
- any intentional public compatibility endpoints are documented

## Final Legacy Removal Phase

After parity passes, remove:

- legacy `traces` table usage from production reads/writes
- legacy trace storage methods
- old dashboard APIs that expose the old model
- old tests that assert legacy internals
- compatibility-only payload types no longer used by current clients

Keep only intentional public compatibility endpoints, implemented as OTel reads/adapters.

Drop the legacy table only in a final migration with a documented upgrade path.

## Validation Already Run

Trace service:

```bash
bun test --env-file=.env.test
bun run build:pulse
```

Result: `126 pass, 0 fail`; full dashboard/server build passed.

TypeScript SDK:

```bash
bun test tests/pricing.test.ts tests/transport.test.ts
bun run typecheck
bun run build
```

Python SDK:

```bash
.venv/bin/python -m pytest
python3 -m compileall src tests
```

CLI:

```bash
cargo check
cargo fmt --check
cargo test
```

Docs:

```bash
bun install --frozen-lockfile
bun run build
```

## Known Caveats

- The legacy `traces` table still exists during the experiment.
- Old ingest/read endpoints still exist as compatibility adapters.
- Full legacy deletion is intentionally deferred until parity is proven.
- `trace-sdk-ts` full `bun test` includes E2E coverage that expects a localhost test server; scoped non-E2E tests, typecheck, and build passed.
- `trace-sdk-py` local `uv run` was blocked by a broken local virtualenv Python `platform.mac_ver()` result; pytest and compileall passed directly.
