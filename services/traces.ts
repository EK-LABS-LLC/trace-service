import type { StorageAdapter, TraceQueryFilters } from "../db/adapter";
import type { Trace, NewTrace } from "../db/schema";
import { batchTraceSchema, type TraceInput } from "../shared/validation";

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
  storage: StorageAdapter
): Promise<IngestResult> {
  const parsed = batchTraceSchema.parse(rawTraces);
  return ingestTraceBatch(projectId, parsed, storage);
}

export async function ingestTraceBatch(
  projectId: string,
  traces: TraceInput[],
  storage: StorageAdapter
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
  storage: StorageAdapter
): Promise<Trace | null> {
  return storage.getTrace(traceId, projectId);
}

/**
 * Query traces for a project with optional filters and pagination.
 */
export async function queryTraces(
  projectId: string,
  filters: TraceQueryFilters,
  storage: StorageAdapter
): Promise<QueryResult> {
  const result = await storage.queryTraces(projectId, filters);

  return {
    traces: result.traces,
    total: result.total,
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  };
}
