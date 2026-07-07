import type { StorageAdapter, TraceQueryFilters } from "../db/adapter";
import type { Trace, NewTrace, TraceSummary } from "../db/schema";
import { batchTraceSchema, type TraceInput } from "../shared/validation";
import { legacyTraceToOtelSpan, toOtelTraceId } from "./otel";

/**
 * Result of a trace ingestion operation.
 */
export interface IngestResult {
  count: number;
  traces: Trace[];
}

/**
 * Result of a trace query operation.
 */
export interface QueryResult {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
}

type AttributeMap = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function attr(attributes: AttributeMap, key: string): unknown {
  return attributes[key];
}

async function summaryToCompatTrace(
  summary: TraceSummary,
  storage: StorageAdapter,
): Promise<Trace> {
  const spans = await storage.getTraceSpans(summary.traceId, summary.projectId);
  const root =
    spans.find((span) => span.spanId === summary.rootSpanId) ??
    spans.find((span) => !span.parentSpanId) ??
    spans[0];
  const attributes = objectValue(summary.attributes) as AttributeMap;
  const spanAttributes = objectValue(root?.attributes) as AttributeMap;
  const metadata = objectValue(root?.metadata);
  const legacyTraceId = stringValue(metadata.legacyTraceId);
  const provider =
    stringValue(attr(spanAttributes, "gen_ai.provider.name")) ??
    stringValue(attr(attributes, "gen_ai.provider.name")) ??
    summary.source;
  const model =
    stringValue(attr(spanAttributes, "gen_ai.response.model")) ??
    stringValue(attr(spanAttributes, "gen_ai.request.model")) ??
    stringValue(attr(attributes, "gen_ai.request.model")) ??
    root?.model ??
    "unknown";

  return {
    traceId: legacyTraceId ?? summary.traceId,
    projectId: summary.projectId,
    timestamp: summary.startedAt,
    provider,
    modelRequested: model,
    modelUsed: model,
    providerRequestId: null,
    requestBody: metadata.requestBody ?? null,
    responseBody: metadata.responseBody ?? null,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    outputText: metadata.outputText ?? null,
    finishReason: metadata.finishReason ?? null,
    status: summary.status,
    error: root?.error ?? null,
    latencyMs: summary.durationMs,
    costCents: summary.costCents,
    sessionId: summary.sessionId,
    metadata: {
      ...metadata,
      otelTraceId: summary.traceId,
      spanCount: summary.spanCount,
      traceName: summary.name,
    },
  } as Trace;
}

function traceMatchesLegacyFilters(trace: Trace, filters: TraceQueryFilters): boolean {
  if (filters.provider && trace.provider !== filters.provider) return false;
  if (filters.model && trace.modelRequested !== filters.model) return false;
  return true;
}

/**
 * Transform incoming trace data (snake_case) to database format (camelCase).
 * Note: projectId is set by the storage adapter, we use a placeholder here.
 */
function toNewTrace(input: TraceInput, projectId: string): NewTrace {
  return {
    traceId: input.trace_id,
    projectId,
    timestamp: new Date(input.timestamp),
    provider: input.provider,
    modelRequested: input.model_requested,
    modelUsed: input.model_used,
    providerRequestId: input.provider_request_id,
    requestBody: input.request_body,
    responseBody: input.response_body,
    inputTokens: input.input_tokens,
    outputTokens: input.output_tokens,
    outputText: input.output_text,
    finishReason: input.finish_reason,
    status: input.status,
    error: input.error,
    latencyMs: input.latency_ms,
    costCents: input.cost_cents,
    sessionId: input.session_id,
    metadata: input.metadata,
  };
}

/**
 * Ingest a batch of traces for a project.
 * Validates incoming data, inserts traces, and upserts sessions.
 */
export async function ingestTraces(
  projectId: string,
  rawTraces: unknown,
  storage: StorageAdapter,
): Promise<IngestResult> {
  const parsed = batchTraceSchema.parse(rawTraces);
  return ingestTraceBatch(projectId, parsed, storage);
}

/**
 * Ingest a batch of traces (synchronous, non-idempotent).
 * Uses regular insertTrace - will fail on duplicates.
 */
export async function ingestTraceBatch(
  projectId: string,
  traces: TraceInput[],
  storage: StorageAdapter,
): Promise<IngestResult> {
  const sessionIds = new Set<string>();
  for (const trace of traces) {
    if (trace.session_id) {
      sessionIds.add(trace.session_id);
    }
  }

  for (const sessionId of sessionIds) {
    await storage.upsertSession(projectId, { id: sessionId, projectId });
  }

  const insertedTraces: Trace[] = [];
  for (const traceInput of traces) {
    const newTrace = toNewTrace(traceInput, projectId);
    const inserted = await storage.insertTrace(projectId, newTrace);
    await legacyTraceToOtelSpan(projectId, traceInput, storage);
    insertedTraces.push(inserted);
  }

  return {
    count: insertedTraces.length,
    traces: insertedTraces,
  };
}

/**
 * Ingest a batch of traces idempotently.
 * Uses insertTraceIdempotent - skips duplicates on insert.
 * Used by WAL processing for crash recovery.
 */
export async function ingestTraceBatchIdempotent(
  projectId: string,
  traces: TraceInput[],
  storage: StorageAdapter,
): Promise<IngestResult> {
  const sessionIds = new Set<string>();
  for (const trace of traces) {
    if (trace.session_id) {
      sessionIds.add(trace.session_id);
    }
  }

  for (const sessionId of sessionIds) {
    await storage.upsertSession(projectId, { id: sessionId, projectId });
  }

  const insertedTraces: Trace[] = [];
  for (const traceInput of traces) {
    const newTrace = toNewTrace(traceInput, projectId);
    const inserted = await storage.insertTraceIdempotent(projectId, newTrace);
    await legacyTraceToOtelSpan(projectId, traceInput, storage);
    insertedTraces.push(inserted);
  }

  return {
    count: insertedTraces.length,
    traces: insertedTraces,
  };
}

/**
 * Get a single trace by ID.
 * Returns null if not found.
 */
export async function getTrace(
  traceId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<Trace | null> {
  const otelTraceId = toOtelTraceId(traceId);
  const summary =
    (await storage.getTraceSummary(otelTraceId, projectId)) ??
    (await storage.getTraceSummary(traceId, projectId));

  if (summary) {
    return summaryToCompatTrace(summary, storage);
  }

  const legacy = await storage.getTrace(traceId, projectId);
  if (!legacy) return null;
  await legacyTraceToOtelSpan(projectId, {
    trace_id: legacy.traceId,
    session_id: legacy.sessionId ?? undefined,
    timestamp: new Date(legacy.timestamp).toISOString(),
    provider: legacy.provider,
    model_requested: legacy.modelRequested,
    model_used: legacy.modelUsed ?? undefined,
    provider_request_id: legacy.providerRequestId ?? undefined,
    request_body: legacy.requestBody,
    response_body: legacy.responseBody,
    input_tokens: legacy.inputTokens ?? undefined,
    output_tokens: legacy.outputTokens ?? undefined,
    output_text: legacy.outputText ?? undefined,
    finish_reason: legacy.finishReason ?? undefined,
    status: legacy.status,
    error: legacy.error,
    latency_ms: legacy.latencyMs,
    cost_cents: legacy.costCents ?? undefined,
    metadata: legacy.metadata,
  }, storage);
  const backfilled = await storage.getTraceSummary(otelTraceId, projectId);
  return backfilled ? summaryToCompatTrace(backfilled, storage) : legacy;
}

/**
 * Query traces for a project with optional filters and pagination.
 */
export async function queryTraces(
  projectId: string,
  filters: TraceQueryFilters,
  storage: StorageAdapter,
): Promise<QueryResult> {
  const summaries = await storage.queryTraceSummaries(projectId, {
    sessionId: filters.sessionId,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: 10_000,
    offset: 0,
    sort: "recent",
  });
  const compatTraces = await Promise.all(
    summaries.traces.map((summary) => summaryToCompatTrace(summary, storage)),
  );
  const filtered = compatTraces.filter((trace) => traceMatchesLegacyFilters(trace, filters));
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;

  return {
    traces: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}
