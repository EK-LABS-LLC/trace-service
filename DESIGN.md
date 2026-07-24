# Unified OTel Traces & Sessions — Design

Date: 2026-07-20
Branch: `feat/unified-otel-traces`
Status: Implemented

## Problem

The dashboard exposes "traces" as an SDK-only concept and splits sessions into
separate LLM and Agents tabs. In reality every emitter — the SDK and the CLI
hooks for Claude Code / Codex — already writes spans carrying `trace_id`,
`session_id`, and `source`. Agent turns are already well-formed OTel traces
(a root `agent.turn` span with tool/assistant/subagent spans beneath it), but
they never surface under "Traces" because the derivation is hardcoded to
`source = 'sdk'`. Meanwhile a parallel _legacy_ trace system (a `traces` SQL
table plus a `sessions` table, fed by direct-JSON ingest endpoints) sits unused
at 0 rows and muddies the model.

## Goal

One unified, source-agnostic OTel model surfaced consistently in the dashboard:

- **Session → Trace → Span**, the standard OTel hierarchy. A session correlates
  many traces via `session_id`; a trace is one turn/request (`trace_id`); a span
  is one operation.
- A single **Traces** view listing every trace regardless of `source`, with a
  source badge (`sdk` / `claude_code` / `codex` / …) and a source filter.
- A single **Sessions** view (no LLM/Agents tab split) grouping all traces by
  `session_id`, with the same source filter.
- The legacy trace/session system removed entirely — code and DB tables — so the
  service speaks only the new OTel shape.

## Non-goals (this pass)

- **Analytics page** — left as-is; not expanded to the unified model now.
- **Subagent visual distinction** — subagent spans currently fold into their
  parent turn's trace and will render as nested spans. Visually distinguishing
  them is a desired follow-up, not part of this work.
- **CLI / SDK changes** — none. The emitted data is already correct OTel.
- **Removing the `spans` telemetry columns or changing ingest** — out of scope.

## What a trace is

A trace = all spans sharing a `trace_id`.

- **Agent trace** (source `claude_code`/`codex`/…): root span is `agent.turn`, opened
  on `user_prompt_submit` and closed on `stop`. Children are `pre_tool_use`,
  `post_tool_use`, `post_tool_use_failure`, `assistant_message`,
  `permission_request`, `subagent_start`, `subagent_stop`. No `llm_call` span —
  the hooks never see the model API call.
- **SDK trace** (source `sdk`): built around an `llm_call` root span with
  `tool_use` children, carrying provider/model/token/cost data.

`session_start` / `session_end` events do not belong to a turn; today they land
in a synthetic per-session `session_lifecycle` trace. These are session markers,
not traces, and are excluded from trace derivation (see below).

## Design

### 1. Source-agnostic trace derivation (server)

Rename `services/sdk-traces.ts` → `services/derived-traces.ts` and make it
source-agnostic. One `TraceSummary` shape for all traces:

Common fields (every trace):

- `traceId`, `sessionId`, `source`, `timestamp`, `durationMs`, `spanCount`,
  `status`, `summary`

LLM-only fields (present only when the trace contains an `llm_call` span; `null`
for agent traces):

- `provider`, `model`, `inputTokens`, `outputTokens`, `costCents`,
  `requestBody`, `responseBody`

`deriveTraceSummary` branches on the presence of an `llm_call` span:

- Has `llm_call` → current behavior; root = the `llm_call` span.
- No `llm_call` → agent turn; root = the `agent.turn` span; `summary` computed
  from child spans.

### 2. The `summary` field

Computed server-side so the table just renders it.

- Agent trace: `"{N} tool calls · {M} files edited"`.
  - `toolCallCount` = number of distinct `tool_use_id` values among
    `tool_use` spans, falling back to `span_id` when no tool-use id exists.
  - `filesEdited` = count of distinct file paths pulled from `tool_input` of
    edit-type tools. Edit-tool names are maintained as a small per-agent list
    (Claude: `Edit`, `Write`, `MultiEdit`; Codex: `apply_patch`). When no edit
    tools are recognized, fall back to just `"{N} tool calls"`. This is an
    intentionally heuristic, best-effort label.
- SDK trace: `summary` = the model name (or a short request preview), preserving
  today's at-a-glance value.

### 3. Trace ID query (server, both adapters)

`querySdkTraceIds` → `queryTraceIds` in `db/sqlite.ts` and `db/postgres.ts`:

- Drop the `eq(spans.source, 'sdk')` condition so all sources form traces.
- Exclude `event_type IN ('session_start', 'session_end')` from grouping so the
  synthetic `session_lifecycle` trace never appears as a junk trace. Session
  start/end remain readable directly from spans as session metadata.
- `provider` / `model` grouping expressions already `COALESCE` around
  `llm_call`; they stay and simply yield the LLM values when present.

### 4. Traces view (dashboard)

`components/traces/TracesTable.tsx` — source-adaptive columns:

`Source` (badge) · `Summary` · `Timestamp` · `Duration` · `Spans` · `Model` ·
`Tokens` · `Cost` · `Status` · `Session`

`Model` / `Tokens` / `Cost` render `--` for agent traces. Add a **Source filter**
control (All / sdk / claude / codex / …) that passes through as a query param.

`components/traces/TraceDetailPanel.tsx` — render a **span tree / timeline for
every trace**. When LLM fields are present, additionally show the existing
request/response panels. Agent traces show only the tree.

### 5. Sessions view (dashboard)

Remove the LLM/Agents tab split in `pages/Sessions.tsx`. One session list
grouping all traces by `session_id` regardless of source, with the same Source
filter to narrow (e.g. `claude_code`). Each session row: source badge(s), trace
count, span count, duration, and tokens/cost when any LLM traces are present.
`pages/SessionDetail.tsx` → the session's traces, each drillable into that
trace's span tree. Unify the two existing code paths
(`SessionsTable` / `useSessionDetailQuery` legacy and
`AgentSessionsTable` / `useSessionSpansQuery`) into one span-derived path.

### 6. Endpoints

- Keep: `POST /v1/traces` (OTLP → spans), `GET /v1/traces`, `GET /v1/traces/:id`
  (now purely span-derived), all `/v1/spans/*`, and the span-derived sessions
  endpoint (unified, source-agnostic).
- Remove: `POST /v1/traces/batch`, `POST /v1/traces/async` and their handlers.
- `GET /v1/traces` (`routes/traces.ts`): drop the merge with the legacy `traces`
  table; serve only span-derived traces. Source filter added as a query param on
  `/v1/traces` and the sessions endpoint.

## Legacy removal

Destructive but safe: both tables are fully legacy and sit at 0 rows.

### Database (migration)

New Drizzle migration drops `traces` and `sessions` in both the single and scale
schemas. `spans.session_id` is a plain text column (no FK), so spans are
unaffected.

### Server code to delete

- `services/traces.ts` — legacy path (`ingestTraces`, `queryTraces`, `getTrace`,
  session upserts).
- `services/sessions.ts` — legacy `getSessionTraces` LLM-session path (replaced
  by the span-derived session service).
- Handlers `handleBatchTraces`, `handleAsyncTrace` and their routes
  (`app.ts:98-99`).
- Adapter methods on sqlite + postgres: `queryTraces`, `getTrace`,
  `upsertSession`, `getSessionTraces`, plus the trace-ingest event-bus
  subject/listener.
- Validation `batchTraceSchema`; the `traces` and `sessions` table definitions
  and `Trace` / `Session` / `NewTrace` / `NewSession` types
  (`db/schema-single.ts`, `db/schema-scale.ts`, `db/schema.ts`).

### Dashboard code to delete / merge

- Merge `SessionsTable` + `AgentSessionsTable` into one table; drop the tab
  switcher and the `llm` / `agents` view state in `pages/Sessions.tsx`.
- Remove `useSessionDetailQuery` / legacy `api/sessions` paths that read the
  legacy tables; keep the span-derived queries.

## Testing

- Server: unit tests for `deriveTraceSummary` covering (a) an SDK trace with an
  `llm_call` span, (b) an agent trace with tool spans → correct
  `toolCallCount` / `filesEdited` / `summary`, (c) a trace whose only spans are
  `session_start` / `session_end` → excluded. Update `tests/traces.test.ts` and
  `tests/otlp-traces.test.ts` for the removed legacy endpoints and the broadened
  derivation; keep the OTLP span-ingest coverage.
- Adapter parity: `queryTraceIds` returns identical trace ids/order under sqlite
  and postgres, across combined and split modes.
- Migration: applying the drop migration on a DB with existing spans leaves
  spans intact and removes the two tables.
- Dashboard: the unified Traces table renders agent and SDK rows together and the
  source filter narrows correctly; a session shows all its traces regardless of
  source.

## Implementation result

Implemented on `feat/unified-otel-traces`:

- Traces and sessions are derived exclusively from spans in SQLite and
  PostgreSQL, with legacy trace/session tables and ingest paths removed.
- Lifecycle markers remain available as spans but cannot create traces,
  inflate session trace counts, or add phantom source badges.
- Sessions use one paginated, URL-backed list with source filtering, mixed-source
  badges, aggregate metrics, and trace-to-span-tree drill-down.
- SQLite and PostgreSQL pass the full 89-test integration suite in both combined
  and split-process runtime modes. Dashboard type-check, production build, and
  lint also pass.
- A seeded live runtime verified authenticated Sessions listing, SDK filtering,
  session detail, and trace detail. Interactive browser verification was not
  available in the execution environment.

## Rollout

All changes land on `feat/unified-otel-traces` in the `trace-service` repo (the
pulse root is not a git repo). This is intended to merge before the monorepo
migration begins, so the imported history already reflects the unified model.
