# Unified OTel Traces & Legacy Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface every OTel trace (SDK + Claude Code/Codex agent turns) in one source-agnostic Traces and Sessions view, and delete the unused legacy `traces`/`sessions` system entirely.

**Architecture:** Traces are already spans grouped by `trace_id`; only the read/derivation layer is SDK-locked. We broaden derivation to all sources, compute an agent-friendly summary, unify the dashboard views, then remove the legacy direct-ingest tables, endpoints, and code.

**Tech Stack:** Bun + TypeScript, Hono, Drizzle ORM (SQLite via `bun:sqlite`, Postgres via `Bun.sql`), Zod, React + TanStack Query + Tailwind (dashboard). Tests: `bun test` (HTTP-integration suite + new pure-function unit tests).

## Global Constraints

- Source values are exactly: `claude_code`, `codex`, `opencode`, `openclaw`, `sdk` (`shared/validation.ts` `spanSourceSchema`). There is no bare `claude`.
- `event_type → kind`: `pre_tool_use`/`post_tool_use`/`post_tool_use_failure`/`permission_request` → `tool_use`; `session_start`/`session_end`/`stop` → `session`; `subagent_start`/`subagent_stop` → `agent_run`; `user_prompt_submit` → `user_prompt`; `assistant_message` → `llm_response`. **`stop` is kind `session` but belongs to a turn** — exclude lifecycle by `event_type IN ('session_start','session_end')`, never by `kind = 'session'`.
- A tool call = one distinct `tool_use_id` among `kind = 'tool_use'` spans (pre+post share an id; do not double-count).
- No CLI/SDK changes. No analytics-page changes.
- Every schema change must be applied to **both** `db/schema-single.ts` and `db/schema-scale.ts`, and migrations generated for **both** `drizzle.config.ts` and `drizzle.scale.config.ts`.
- Use Bun: `bun test`, `bunx drizzle-kit ...`. Commit after each task.
- Test execution: `tests/derived-traces.test.ts` is a pure unit test — run it directly with `bun test tests/derived-traces.test.ts`. The `tests/*.test.ts` HTTP-integration files need a running server; run them through `bash scripts/run-e2e.sh single` (SQLite) / `bash scripts/run-e2e.sh scale` (Postgres), which boots the service first. When a task says "run `bun test tests/X.test.ts`", either have the dev server up (`bun run dev`) or run the matching e2e mode.
- Work on branch `feat/unified-otel-traces` (already checked out).

---

## File Structure

**Server — modified:**

- `services/sdk-traces.ts` → renamed `services/derived-traces.ts` — source-agnostic trace derivation + summary.
- `db/adapter.ts` — trim `StorageAdapter` to the span-derived surface; rename `querySdkTraceIds` → `queryTraceIds`; add `source` to `TraceQueryFilters`.
- `db/sqlite.ts`, `db/postgres.ts` — broaden `queryTraceIds`; delete legacy trace/session methods.
- `db/schema-single.ts`, `db/schema-scale.ts`, `db/schema.ts` — remove `traces` + `sessions` tables and their types.
- `routes/traces.ts` — GET serves span-derived only + source filter; remove batch/async handlers.
- `routes/sessions.ts`, `services/sessions.ts` — span-derived sessions only.
- `shared/validation.ts` — remove `traceSchema`/`batchTraceSchema`/`traceSchema`-derived types; add `source` to `traceQuerySchema`.
- `event-bus/subjects.ts`, `event-bus/listener.ts` — remove trace-ingest subject + listener.
- `app.ts` — drop `/v1/traces/batch`, `/v1/traces/async` routes.

**Server — created:**

- `drizzle/000X_drop_legacy_traces.sql` (+ scale equivalent) — generated drop migration.
- `tests/derived-traces.test.ts` — unit tests for the pure derivation/summary functions.

**Dashboard — modified:**

- `dashboard/src/lib/apiClient.ts` — `Trace` type gains `source`/`summary`/`spanCount`/`durationMs`; `GetTracesParams` gains `source`.
- `dashboard/src/components/traces/TracesTable.tsx` — source-adaptive columns + source badge.
- `dashboard/src/pages/Traces.tsx` — source filter control.
- `dashboard/src/components/traces/TraceDetailPanel.tsx` — span tree for all traces; LLM panels when present.
- `dashboard/src/pages/Sessions.tsx`, `dashboard/src/pages/SessionDetail.tsx` — remove LLM/Agents tab split; one span-derived list.

---

## Task 1: Source-agnostic trace summary (pure logic)

Rename the derivation module and make `deriveTraceSummary` produce a unified summary that works for agent traces (no `llm_call` span).

**Files:**

- Rename: `services/sdk-traces.ts` → `services/derived-traces.ts`
- Test: `tests/derived-traces.test.ts` (create)

**Interfaces:**

- Produces: `TraceSummary` (renamed from `SdkTraceSummary`) with added fields `source: string`, `spanCount: number`, `summary: string`, `toolCallCount: number`, `filesEdited: number`. Existing LLM fields (`provider`, `model*`, `*Tokens`, `costCents`, `requestBody`, `responseBody`) stay, `null`/`undefined` for agent traces.
- Produces: `deriveTraceSummary(traceId: string, spans: Span[]): TraceSummary`
- Produces: `EDIT_TOOL_NAMES: Set<string>`

- [ ] **Step 1: Rename the module and update imports**

```bash
git mv services/sdk-traces.ts services/derived-traces.ts
rg -l "services/sdk-traces" | xargs sed -i '' 's#services/sdk-traces#services/derived-traces#g'
```

Run `rg "sdk-traces"` and confirm no source references remain (ignore this plan file).

- [ ] **Step 2: Write failing unit tests**

Create `tests/derived-traces.test.ts`:

```ts
import { test, expect } from "bun:test";
import { deriveTraceSummary } from "../services/derived-traces";
import type { Span } from "../db/schema";

function span(overrides: Partial<Span>): Span {
  return {
    spanId: crypto.randomUUID(),
    traceId: "t1",
    projectId: "p1",
    sessionId: "s1",
    parentSpanId: null,
    timestamp: new Date("2026-07-20T00:00:00Z"),
    durationMs: 0,
    source: "claude_code",
    kind: "tool_use",
    eventType: "post_tool_use",
    status: "success",
    toolUseId: null,
    toolName: null,
    toolInput: null,
    toolResponse: null,
    error: null,
    isInterrupt: null,
    cwd: null,
    model: null,
    agentName: null,
    provider: null,
    modelUsed: null,
    inputTokens: null,
    outputTokens: null,
    costCents: null,
    finishReason: null,
    outputText: null,
    providerRequestId: null,
    metadata: null,
    ...overrides,
  } as Span;
}

test("agent turn summarises tool calls and files edited", () => {
  const spans = [
    span({
      kind: "user_prompt",
      eventType: "user_prompt_submit",
      durationMs: 10,
    }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "a",
      toolName: "Edit",
      toolInput: { file_path: "/x.ts" },
      durationMs: 5,
    }),
    span({
      kind: "tool_use",
      eventType: "pre_tool_use",
      toolUseId: "a",
      toolName: "Edit",
      toolInput: { file_path: "/x.ts" },
    }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "b",
      toolName: "Write",
      toolInput: { file_path: "/y.ts" },
      durationMs: 5,
    }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "c",
      toolName: "Bash",
      durationMs: 5,
    }),
  ];
  const s = deriveTraceSummary("t1", spans);
  expect(s.source).toBe("claude_code");
  expect(s.toolCallCount).toBe(3); // distinct tool_use_id a,b,c
  expect(s.filesEdited).toBe(2); // /x.ts, /y.ts
  expect(s.summary).toBe("3 tool calls · 2 files edited");
  expect(s.provider).toBeNull();
  expect(s.spanCount).toBe(5);
});

test("agent turn with no edit tools falls back to tool count", () => {
  const spans = [
    span({ kind: "user_prompt", eventType: "user_prompt_submit" }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "a",
      toolName: "Bash",
    }),
  ];
  expect(deriveTraceSummary("t1", spans).summary).toBe("1 tool calls");
});

test("sdk trace keeps llm fields and models the summary", () => {
  const spans = [
    span({
      source: "sdk",
      kind: "llm_call",
      eventType: "provider_call",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 20,
      costCents: 3,
      durationMs: 800,
    }),
  ];
  const s = deriveTraceSummary("t1", spans);
  expect(s.source).toBe("sdk");
  expect(s.provider).toBe("openai");
  expect(s.inputTokens).toBe(100);
  expect(s.summary).toBe("gpt-4o-mini");
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `bun test tests/derived-traces.test.ts`
Expected: FAIL (`source`/`summary`/`toolCallCount`/`filesEdited` undefined).

- [ ] **Step 4: Implement the unified summary**

In `services/derived-traces.ts`, rename the interface `SdkTraceSummary` → `TraceSummary` (keep a `export type SdkTraceSummary = TraceSummary` alias only if other files still import the old name; prefer updating imports). Add the new fields and edit-tool set, and rewrite `deriveTraceSummary`:

```ts
export const EDIT_TOOL_NAMES = new Set([
  "Edit",
  "Write",
  "MultiEdit",
  "apply_patch",
]);

function editedFilePath(span: Span): string | undefined {
  if (!span.toolName || !EDIT_TOOL_NAMES.has(span.toolName)) return undefined;
  const input = span.toolInput;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const fp = (input as Record<string, unknown>).file_path;
    if (typeof fp === "string" && fp.length > 0) return fp;
  }
  return undefined;
}

function buildSummary(
  isLlm: boolean,
  model: string,
  toolCallCount: number,
  filesEdited: number,
): string {
  if (isLlm) return model;
  const base = `${toolCallCount} tool calls`;
  return filesEdited > 0 ? `${base} · ${filesEdited} files edited` : base;
}
```

Then in `deriveTraceSummary`, after `const sorted = ...` and the existing `providerSpan`/`llmSpans` logic, compute:

```ts
const isLlm = sorted.some((s) => s.kind === "llm_call");
const toolSpans = sorted.filter((s) => s.kind === "tool_use");
const toolCallCount = new Set(toolSpans.map((s) => s.toolUseId ?? s.spanId))
  .size;
const filesEdited = new Set(
  toolSpans.map(editedFilePath).filter((p): p is string => p !== undefined),
).size;
const model = providerSpan.model ?? "unknown";
```

and add to the returned object:

```ts
    source: providerSpan.source,
    spanCount: sorted.length,
    summary: buildSummary(isLlm, model, toolCallCount, filesEdited),
    toolCallCount,
    filesEdited,
    // LLM fields become null (not undefined) for agent traces:
    provider: isLlm ? sdkProvider(providerSpan) : null,
    modelRequested: isLlm ? model : null,
    modelUsed: isLlm ? (providerSpan.modelUsed ?? model) : null,
    inputTokens: isLlm ? sumTokens((s) => s.inputTokens) : null,
    outputTokens: isLlm ? sumTokens((s) => s.outputTokens) : null,
    costCents: isLlm ? sumTokens((s) => s.costCents) : null,
    requestBody: isLlm ? requestBody : null,
    responseBody: isLlm ? responseBody : null,
```

Update the `TraceSummary` interface field types to allow `null` where the above returns `null`, and add `source: string; spanCount: number; summary: string; toolCallCount: number; filesEdited: number;`. Keep `latencyMs`, `timestamp`, `sessionId`, `status`, `metadata`, `spans` as-is.

- [ ] **Step 5: Run tests, verify they pass**

Run: `bun test tests/derived-traces.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add services/derived-traces.ts tests/derived-traces.test.ts
git add -u
git commit -m "feat(traces): source-agnostic trace summary derivation"
```

---

## Task 2: Broaden trace-id query to all sources (both adapters)

Rename `querySdkTraceIds` → `queryTraceIds`, drop the `source='sdk'` filter, exclude lifecycle events, and support a `source` filter.

**Files:**

- Modify: `db/adapter.ts` (interface + `TraceQueryFilters`)
- Modify: `db/sqlite.ts:357-401`
- Modify: `db/postgres.ts:357-401` (parallel)
- Modify: `services/derived-traces.ts` (`querySdkTraceSummaries`/`queryAllSdkSpans` call sites)
- Test: `tests/traces.test.ts` (extend — HTTP integration, see existing file for the ingest+read pattern)

**Interfaces:**

- Consumes: `TraceSummary`, `deriveTraceSummary` (Task 1)
- Produces: `queryTraceIds(projectId, filters?): Promise<TraceIdQueryResult>` on `StorageAdapter`
- Produces: `TraceQueryFilters` gains `source?: string`

- [ ] **Step 1: Update the adapter interface**

In `db/adapter.ts`: add `source?: string;` to `TraceQueryFilters`; rename `SdkTraceIdQueryResult` → `TraceIdQueryResult`; rename the method `querySdkTraceIds` → `queryTraceIds`. (Legacy trace methods are removed in Task 4 — leave them for now to keep the build green.)

- [ ] **Step 2: Write a failing integration test**

Extend `tests/traces.test.ts` following the file's existing helpers (API-key ingest to `POST /v1/traces` with an OTLP payload or `POST /v1/spans/batch`, then `GET /v1/traces`). Add:

```ts
test("agent-source spans appear as traces", async () => {
  const { projectId, apiKey } = await createTestProject();
  await ingestSpans(apiKey, [
    {
      span_id: "sp1",
      trace_id: "trace-agent-1",
      session_id: "sess-1",
      timestamp: new Date().toISOString(),
      source: "claude_code",
      kind: "user_prompt",
      event_type: "user_prompt_submit",
      status: "success",
    },
    {
      span_id: "sp2",
      trace_id: "trace-agent-1",
      session_id: "sess-1",
      timestamp: new Date().toISOString(),
      source: "claude_code",
      kind: "tool_use",
      event_type: "post_tool_use",
      tool_use_id: "a",
      tool_name: "Bash",
      status: "success",
    },
  ]);
  const res = await dashboardFetch("/v1/traces", projectId);
  const body = await res.json();
  const ids = body.traces.map((t: { traceId: string }) => t.traceId);
  expect(ids).toContain("trace-agent-1");
});

test("session_start/session_end spans do not form a trace", async () => {
  const { projectId, apiKey } = await createTestProject();
  await ingestSpans(apiKey, [
    {
      span_id: "sl1",
      trace_id: "lifecycle-1",
      session_id: "sess-2",
      timestamp: new Date().toISOString(),
      source: "claude_code",
      kind: "session",
      event_type: "session_start",
      status: "success",
    },
    {
      span_id: "sl2",
      trace_id: "lifecycle-1",
      session_id: "sess-2",
      timestamp: new Date().toISOString(),
      source: "claude_code",
      kind: "session",
      event_type: "session_end",
      status: "success",
    },
  ]);
  const res = await dashboardFetch("/v1/traces", projectId);
  const ids = (await res.json()).traces.map(
    (t: { traceId: string }) => t.traceId,
  );
  expect(ids).not.toContain("lifecycle-1");
});
```

(Reuse or add small `createTestProject` / `ingestSpans` helpers mirroring the patterns already in `tests/traces.test.ts` and `tests/spans.test.ts`.)

- [ ] **Step 3: Run tests, verify they fail**

Run: `bun test tests/traces.test.ts`
Expected: FAIL (agent traces missing; lifecycle trace present) — or a compile error until Step 4.

- [ ] **Step 4: Implement in `db/sqlite.ts`**

Replace `querySdkTraceIds` with `queryTraceIds`:

```ts
async queryTraceIds(
  projectId: string,
  filters: TraceQueryFilters = {},
): Promise<TraceIdQueryResult> {
  const conditions = [
    eq(spans.projectId, projectId),
    notInArray(spans.eventType, ["session_start", "session_end"]),
  ];
  if (filters.source) conditions.push(eq(spans.source, filters.source));
  if (filters.sessionId) conditions.push(eq(spans.sessionId, filters.sessionId));
  if (filters.dateFrom) conditions.push(gte(spans.timestamp, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(spans.timestamp, filters.dateTo));
  const whereClause = and(...conditions);
  const provider = sql<string>`COALESCE(MAX(CASE WHEN ${spans.kind} = 'llm_call' THEN ${spans.provider} END), MAX(${spans.source}))`;
  const model = sql<string>`COALESCE(MAX(CASE WHEN ${spans.kind} = 'llm_call' THEN ${spans.model} END), 'unknown')`;
  const errors = sql<number>`SUM(CASE WHEN ${spans.status} = 'error' THEN 1 ELSE 0 END)`;
  const having = and(
    filters.provider ? sql`${provider} = ${filters.provider}` : undefined,
    filters.model ? sql`${model} = ${filters.model}` : undefined,
    filters.status === "error" ? sql`${errors} > 0` : undefined,
    filters.status === "success" ? sql`${errors} = 0` : undefined,
  );
  const groups = this.db
    .select({
      traceId: spans.traceId,
      timestamp: sql<number>`MIN(${spans.timestamp})`.as("timestamp"),
    })
    .from(spans)
    .where(whereClause)
    .groupBy(spans.traceId)
    .having(having)
    .as("trace_groups");
  const [countRows, rows] = await Promise.all([
    this.db.select({ total: count() }).from(groups),
    this.db
      .select({ traceId: groups.traceId })
      .from(groups)
      .orderBy(desc(groups.timestamp))
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0),
  ]);
  return {
    traceIds: rows.map((r: { traceId: string }) => r.traceId).filter((id): id is string => id != null),
    total: countRows[0]?.total ?? 0,
  };
}
```

Add `notInArray` to the drizzle imports at the top of `db/sqlite.ts` if not present.

- [ ] **Step 5: Mirror in `db/postgres.ts`**

Apply the identical change to `db/postgres.ts` `queryTraceIds` (same Drizzle API; ensure `notInArray` imported).

- [ ] **Step 6: Update `services/derived-traces.ts` call sites**

`queryAllSdkSpans` currently forces `source: "sdk"`. Remove that hard filter and instead pass through `filters.source`. In `querySdkTraceSummaries` rename to `queryTraceSummaries` and call `storage.queryTraceIds`. Update `routes/traces.ts` import accordingly (fully handled in Task 3).

- [ ] **Step 7: Run tests, verify they pass**

Run: `bun test tests/traces.test.ts`
Expected: PASS (agent trace present; lifecycle absent).

- [ ] **Step 8: Commit**

```bash
git add db/adapter.ts db/sqlite.ts db/postgres.ts services/derived-traces.ts tests/traces.test.ts
git commit -m "feat(traces): derive traces from all sources, exclude lifecycle events"
```

---

## Task 3: Unified GET /v1/traces (drop legacy merge, add source filter)

**Files:**

- Modify: `routes/traces.ts:24-72` (keep OTLP POST), `:161-297` (GET list + by id)
- Modify: `shared/validation.ts:45-54` (`traceQuerySchema` gains `source`)

**Interfaces:**

- Consumes: `queryTraceSummaries`, `getSdkTraceSummary` (Task 2/1)
- Produces: `GET /v1/traces?source=claude_code` returns only span-derived traces

- [ ] **Step 1: Add `source` to the query schema**

In `shared/validation.ts` `traceQuerySchema`, add: `source: spanSourceSchema.optional(),`. Relax `provider` from `providerSchema.optional()` to `z.string().optional()` (agent traces report their source as provider).

- [ ] **Step 2: Write failing test**

Add to `tests/traces.test.ts`:

```ts
test("source filter narrows trace list", async () => {
  const { projectId, apiKey } = await createTestProject();
  await ingestSpans(apiKey, [
    {
      span_id: "c1",
      trace_id: "tc",
      session_id: "s",
      timestamp: new Date().toISOString(),
      source: "claude_code",
      kind: "user_prompt",
      event_type: "user_prompt_submit",
      status: "success",
    },
    {
      span_id: "k1",
      trace_id: "tk",
      session_id: "s",
      timestamp: new Date().toISOString(),
      source: "sdk",
      kind: "llm_call",
      event_type: "provider_call",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
    },
  ]);
  const res = await dashboardFetch("/v1/traces?source=claude_code", projectId);
  const ids = (await res.json()).traces.map(
    (t: { traceId: string }) => t.traceId,
  );
  expect(ids).toContain("tc");
  expect(ids).not.toContain("tk");
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `bun test tests/traces.test.ts`
Expected: FAIL (source filter not wired; legacy merge may still return rows).

- [ ] **Step 4: Rewrite `getTraces` in `routes/traces.ts`**

Remove the `queryTraces` (legacy table) merge and `mergeTracePages` legacy branch. Serve only derived traces:

```ts
const filters = {
  sessionId: params.session_id,
  source: params.source,
  provider: params.provider,
  model: params.model,
  status: params.status,
  dateFrom,
  dateTo,
  limit: params.limit,
  offset: params.offset,
};
const page = await queryTraceSummaries(projectId, storage, filters);
return c.json(
  {
    traces: page.traces,
    total: page.total,
    limit: params.limit,
    offset: params.offset,
  },
  200,
);
```

In `getTraceById`, drop the legacy `getTrace` lookup and return `getSdkTraceSummary(traceId, projectId, storage)` (rename to `getTraceSummary` in `derived-traces.ts`) or 404. Remove now-unused imports (`ingestTraces`, `queryTraces`, `getTrace`, `mergeTracePages`).

- [ ] **Step 5: Run test, verify it passes**

Run: `bun test tests/traces.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add routes/traces.ts shared/validation.ts tests/traces.test.ts
git commit -m "feat(traces): unify GET /v1/traces to span-derived with source filter"
```

---

## Task 4: Remove legacy trace ingest endpoints & event bus

**Files:**

- Modify: `app.ts:98-99` (remove routes)
- Modify: `routes/traces.ts` (remove `handleBatchTraces`, `handleAsyncTrace`)
- Modify: `event-bus/subjects.ts` (remove `TRACE_INGEST_*`, `buildTraceIngestSubject`, `TraceIngestEventPayload`)
- Modify: `event-bus/listener.ts` (remove trace-ingest listener path)
- Modify: `tests/traces.test.ts` (delete batch/async ingest tests)

- [ ] **Step 1: Delete the batch/async tests**

Remove tests in `tests/traces.test.ts` that POST to `/v1/traces/batch` or `/v1/traces/async`. Keep the derived-trace read tests from Tasks 2–3.

- [ ] **Step 2: Remove routes and handlers**

In `app.ts` delete lines registering `/v1/traces/batch` and `/v1/traces/async` and their imports. In `routes/traces.ts` delete `handleBatchTraces` and `handleAsyncTrace` and their now-unused imports (`ingestTraces`, `batchTraceSchema`, `getEventBus`, `buildTraceIngestSubject`, `TraceInput`).

- [ ] **Step 3: Remove trace-ingest event bus**

In `event-bus/subjects.ts` delete `TRACE_INGEST_SUBJECT`, `TRACE_INGEST_WILDCARD`, `buildTraceIngestSubject`, `TraceIngestEventPayload`. In `event-bus/listener.ts` remove the subscription/handler that consumed `TRACE_INGEST_WILDCARD` and called `ingestTraces`. Leave all span-ingest wiring intact.

- [ ] **Step 4: Typecheck + run suite**

Run: `bunx tsc --noEmit` then `bun test tests/traces.test.ts`
Expected: compiles; trace read tests PASS; no references to removed endpoints.

- [ ] **Step 5: Commit**

```bash
git add app.ts routes/traces.ts event-bus/subjects.ts event-bus/listener.ts tests/traces.test.ts
git commit -m "refactor: remove legacy trace ingest endpoints and event bus"
```

---

## Task 5: Remove legacy adapter methods & services

**Files:**

- Modify: `db/adapter.ts` (drop legacy trace/session methods)
- Modify: `db/sqlite.ts`, `db/postgres.ts` (drop implementations)
- Delete: `services/traces.ts`
- Modify: `services/sessions.ts`, `routes/sessions.ts` (span-derived only)
- Modify: `services/derived-traces.ts` (remove `mergeTracePages` if unused)

- [ ] **Step 1: Trim the adapter interface**

In `db/adapter.ts` remove: `insertTrace`, `insertTraceIdempotent`, `getTrace`, `queryTraces`, `countTraces`, `upsertSession`, `getSessionTraces`, and `TraceQueryResult`. Keep all span methods, `queryAgentSessions`, `getSessionSpans`, `queryTraceIds`. Remove the `Trace`/`NewTrace`/`Session`/`NewSession` imports.

- [ ] **Step 2: Remove implementations**

Delete the corresponding method bodies in `db/sqlite.ts` and `db/postgres.ts`. Delete `services/traces.ts` (`git rm services/traces.ts`). Remove `mergeTracePages` from `services/derived-traces.ts` if no longer referenced (`rg mergeTracePages`).

- [ ] **Step 3: Make sessions span-derived**

`services/sessions.ts` `getSessionTraces`-based path is gone. Rewrite the session-detail service to build `TraceSummary[]` from `getSessionSpans` grouped by `trace_id` (reuse `listSdkSessionTraceSummaries`, renamed `listSessionTraceSummaries`). Update `routes/sessions.ts` to call it and remove the legacy `getSessionTraces` merge.

- [ ] **Step 4: Typecheck + run suite**

Run: `bunx tsc --noEmit` then `bun test tests/sessions.test.ts tests/traces.test.ts tests/spans.test.ts`
Expected: compiles; PASS (update any session-detail test expectations to the derived shape).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy trace/session storage methods and services"
```

---

## Task 6: Drop `traces` and `sessions` tables (schema + migration)

**Files:**

- Modify: `db/schema-single.ts:49-82` (remove `traces`), `:38-47` (remove `sessions`) and their types `:84-91,121-122`
- Modify: `db/schema-scale.ts` (remove the parallel `traces` + `sessions` definitions/types)
- Modify: `db/schema.ts:7-8,17-18,21-22` (remove `sessions`/`traces` exports and `Session`/`Trace` types)
- Modify: `shared/validation.ts` (remove `traceSchema`, `batchTraceSchema`, and the `TraceInput`/`BatchTraceInput`/`TraceQueryParams` re-derivations that no longer apply; keep `traceQuerySchema`, `statusSchema`, `providerSchema`)
- Create: `drizzle/000X_drop_legacy_traces.sql` + scale equivalent (generated)

- [ ] **Step 1: Confirm no remaining references**

Run: `rg -n "\\btraces\\b|\\bsessions\\b" db services routes shared --glob '*.ts' | rg -v "spans|traceId|sessionId|queryTraceIds|TraceSummary|agentSession|traceQuerySchema"`
Expected: only the schema definitions themselves remain (everything else removed in Tasks 4–5). Fix any stragglers before dropping.

- [ ] **Step 2: Remove table definitions**

Delete the `sessions` and `traces` `sqliteTable(...)` blocks and their `Session`/`Trace`/`NewSession`/`NewTrace` type exports in `db/schema-single.ts`; do the same in `db/schema-scale.ts`; remove the `sessions`/`traces` re-exports and `Session`/`Trace` types in `db/schema.ts`. Remove `traceSchema`/`batchTraceSchema` from `shared/validation.ts`.

- [ ] **Step 3: Generate the drop migration (single/SQLite)**

The single schema uses generated SQL migrations; the scale schema uses push (`db:migrate:scale` → `drizzle-kit push`). Generate the single migration:

```bash
bun run db:generate   # bunx drizzle-kit generate (drizzle.config.ts)
```

Expected: a new `drizzle/000X_*.sql` file containing ``DROP TABLE `traces`;`` and ``DROP TABLE `sessions`;``. Inspect it to confirm it only drops those two tables. (The scale schema needs no SQL file — its diff is applied by push in Step 4.)

- [ ] **Step 4: Apply and verify migration on a spans-populated DB**

Start the service against a scratch SQLite DB, ingest a span, apply the migration, and confirm spans survive while the two tables are gone:

```bash
bun run db:migrate         # single/SQLite (scripts/migrate.ts)
bun run db:migrate:scale   # scale/Postgres (drizzle-kit push)
```

Then in a quick check:

```bash
bun -e "import { Database } from 'bun:sqlite'; const db = new Database(process.env.DB_PATH); console.log(db.query(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('traces','sessions','spans')\").all());"
```

Expected: only `spans` listed.

- [ ] **Step 5: Full suite in both DB modes**

Run the integration harness (spins up the server) in both modes: `bash scripts/run-e2e.sh single` then `bash scripts/run-e2e.sh scale`.
Expected: PASS in SQLite combined/split and Postgres combined/split.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): drop legacy traces and sessions tables"
```

---

## Task 7: Dashboard — unified Traces table + source filter

**Files:**

- Modify: `dashboard/src/lib/apiClient.ts` (`Trace` type, `GetTracesParams`)
- Modify: `dashboard/src/components/traces/TracesTable.tsx`
- Modify: `dashboard/src/pages/Traces.tsx`

**Interfaces:**

- Consumes: `GET /v1/traces` unified shape (Task 3)

- [ ] **Step 1: Extend the client types**

In `dashboard/src/lib/apiClient.ts`, add to the `Trace` type: `source: string; summary: string; spanCount: number;` and make `provider`/`modelRequested`/`modelUsed`/`inputTokens`/`outputTokens`/`costCents` nullable. Add `source?: string` to `GetTracesParams` and forward it as a query param in `getTraces`.

- [ ] **Step 2: Source-adaptive table columns**

In `TracesTable.tsx`: add a leading **Source** column rendering a badge from `trace.source` (map `claude_code`→"Claude Code", `codex`→"Codex", `sdk`→"SDK", else the raw value). Replace the `Provider`/`Model` cells so agent traces (`trace.provider == null`) show the `Summary` text and `--` for `Model`/`Input`/`Output`/`Cost`; SDK traces render as today. Add a **Spans** column (`trace.spanCount`). Concretely, in the row body add:

```tsx
<td className="py-2.5 px-4">
  <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
    {sourceLabel(trace.source)}
  </span>
</td>
<td className="py-2.5 px-4">
  <span className="text-sm text-neutral-300 truncate max-w-[280px] inline-block" title={trace.summary}>
    {trace.summary}
  </span>
</td>
```

and guard the metric cells with `trace.inputTokens == null ? "--" : formatTokens(...)` etc. Add a `sourceLabel` helper at module scope.

- [ ] **Step 3: Source filter control on the Traces page**

In `dashboard/src/pages/Traces.tsx`, add a filter (reuse the `ToolbarMenu` pattern from `Sessions.tsx`) with options All / Claude Code / Codex / SDK. Store the selection in a URL search param (`source`) and pass it into `useTracesQuery(..., { ...params, source })`.

- [ ] **Step 4: Manual verification**

Run the dashboard + service locally (see repo run scripts), ingest a Claude Code session, and confirm agent turns appear in the Traces table with "N tool calls · M files edited", a Claude Code badge, and that the source filter narrows the list. Confirm SDK traces still show model/tokens/cost.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/apiClient.ts dashboard/src/components/traces/TracesTable.tsx dashboard/src/pages/Traces.tsx
git commit -m "feat(dashboard): unified traces table with source badge and filter"
```

---

## Task 8: Dashboard — trace detail span tree

**Files:**

- Modify: `dashboard/src/components/traces/TraceDetailPanel.tsx`
- Modify: `dashboard/src/pages/TraceDetail.tsx`

- [ ] **Step 1: Render a span tree for every trace**

The `TraceSummary` already carries `spans: Array<Span & { label: string }>`. In `TraceDetailPanel.tsx`, add a spans section that lists `trace.spans` ordered by timestamp, indented by `parentSpanId` depth, showing `label`, `kind`, `status`, and `durationMs`. Render this for all traces.

- [ ] **Step 2: Gate the LLM panels**

Wrap the existing request/response preview blocks (`extractMessagePreview(trace.requestBody ...)`) in `trace.requestBody != null && (...)` so agent traces (null bodies) show only the span tree. Show provider/model/token/cost rows only when `trace.provider != null`.

- [ ] **Step 3: Manual verification**

Open an agent trace → span tree renders, no empty LLM panels. Open an SDK trace → span tree + request/response + metrics.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/traces/TraceDetailPanel.tsx dashboard/src/pages/TraceDetail.tsx
git commit -m "feat(dashboard): span-tree trace detail for all sources"
```

---

## Task 9: Dashboard — unified Sessions (remove LLM/Agents tabs)

**Files:**

- Modify: `dashboard/src/pages/Sessions.tsx`
- Modify: `dashboard/src/pages/SessionDetail.tsx`
- Modify: `dashboard/src/components/sessions/*` (consolidate to one table)

- [ ] **Step 1: Collapse to one session list**

In `Sessions.tsx` remove the `ViewTab`/`activeTab` state, the LLM/Agents tab switcher, and the `groupTracesIntoSessions` LLM path. Keep the agent-sessions query (span-derived) as the single source, rename UI copy from "Agents" to just the session list, and add the same Source filter used in Task 7 (`source` search param) passed to the sessions query. Delete the now-unused `SessionsTable` (legacy LLM) component and keep the consolidated table (from `AgentSessionsTable`, renamed `SessionsTable`).

- [ ] **Step 2: Unify SessionDetail**

In `SessionDetail.tsx` remove the `isAgentView` branch and the legacy `useSessionDetailQuery`. Always load the session's spans/traces via the span-derived session endpoint, and render the session's `TraceSummary[]` as rows that link into `TraceDetail` (each trace's span tree from Task 8).

- [ ] **Step 3: Remove the dead nav/tab query params**

Drop `?tab=agents` / `?tab=llm` handling and any links that set them (search `rg "tab=agents|tab=llm" dashboard/src`).

- [ ] **Step 4: Manual verification**

Sessions page shows one unified list across sources; the source filter narrows to Claude Code; clicking a session shows its traces; clicking a trace opens its span tree.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src
git commit -m "feat(dashboard): unified source-agnostic sessions view"
```

---

## Task 10: Final sweep & verification

- [ ] **Step 1: Reference sweep**

Run: `rg -n "sdk-traces|querySdkTraceIds|SdkTraceSummary|batchTraceSchema|handleBatchTraces|getSessionTraces|upsertSession|/v1/traces/batch|/v1/traces/async|tab=agents|tab=llm" .`
Expected: no matches in source (this plan/DESIGN may match — ignore those two files).

- [ ] **Step 2: Typecheck server + dashboard**

Run: `bunx tsc --noEmit` (server) and the dashboard build/typecheck (`cd dashboard && bun run build`, which runs `tsc -b && vite build`); `cd dashboard && bun run lint`.
Expected: both clean.

- [ ] **Step 3: Full test matrix**

Run: `bun test tests/derived-traces.test.ts` (pure unit, no server), then the integration matrix `bash scripts/run-e2e.sh single` and `bash scripts/run-e2e.sh scale` (SQLite combined+split, Postgres combined+split).
Expected: all PASS.

- [ ] **Step 4: End-to-end smoke**

Run service + dashboard, drive a real Claude Code session through the hooks, and confirm: turns appear as traces, "N tool calls · M files edited" summaries, source badge/filter work, span-tree detail renders, and the session groups its turns. Confirm an SDK `initPulse` run still shows model/tokens/cost.

- [ ] **Step 5: Update DESIGN.md status**

Flip the `Status:` line in `DESIGN.md` to `Implemented` and commit.

```bash
git add DESIGN.md
git commit -m "docs: mark unified OTel traces design implemented"
```

---

## Follow-ups (out of scope, tracked)

- **Subagent visual distinction** — subagent (`agent_run`) spans currently fold into the parent turn's trace; render them as a visually nested/collapsible sub-tree in `TraceDetailPanel`.
- **Analytics page** — revisit once the unified trace model is stable.
- **Codex edit-tool coverage** — verify Codex's real edit tool name(s) and extend `EDIT_TOOL_NAMES` / `editedFilePath` shape handling.
