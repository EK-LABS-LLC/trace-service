import type { StorageAdapter, SpanQueryFilters } from "../db/adapter";
import type { Span, NewSpan } from "../db/schema";
import { batchSpanSchema, type SpanInput } from "../shared/validation";

export interface IngestSpanResult {
  count: number;
  spans: Span[];
}

export interface QuerySpanResult {
  spans: Span[];
  total: number;
  limit: number;
  offset: number;
}

function toNewSpan(input: SpanInput, projectId: string): NewSpan {
  return {
    spanId: input.span_id,
    projectId,
    sessionId: input.session_id,
    parentSpanId: input.parent_span_id,
    timestamp: new Date(input.timestamp),
    durationMs: input.duration_ms,
    source: input.source,
    kind: input.kind,
    eventType: input.event_type,
    status: input.status,
    toolUseId: input.tool_use_id,
    toolName: input.tool_name,
    toolInput: input.tool_input,
    toolResponse: input.tool_response,
    error: input.error,
    isInterrupt: input.is_interrupt,
    cwd: input.cwd,
    model: input.model,
    agentName: input.agent_name,
    metadata: input.metadata,
  };
}

export async function ingestSpans(
  projectId: string,
  rawSpans: unknown,
  storage: StorageAdapter,
): Promise<IngestSpanResult> {
  const parsed = batchSpanSchema.parse(rawSpans);
  return ingestSpanBatch(projectId, parsed, storage);
}

export async function ingestSpanBatch(
  projectId: string,
  spans: SpanInput[],
  storage: StorageAdapter,
): Promise<IngestSpanResult> {
  const insertedSpans: Span[] = [];
  for (const spanInput of spans) {
    const newSpan = toNewSpan(spanInput, projectId);
    const inserted = await storage.insertSpan(projectId, newSpan);
    insertedSpans.push(inserted);
  }

  return {
    count: insertedSpans.length,
    spans: insertedSpans,
  };
}

export async function ingestSpanBatchIdempotent(
  projectId: string,
  spans: SpanInput[],
  storage: StorageAdapter,
): Promise<IngestSpanResult> {
  const insertedSpans: Span[] = [];
  for (const spanInput of spans) {
    const newSpan = toNewSpan(spanInput, projectId);
    const inserted = await storage.insertSpanIdempotent(projectId, newSpan);
    insertedSpans.push(inserted);
  }

  return {
    count: insertedSpans.length,
    spans: insertedSpans,
  };
}

export async function getSpan(
  spanId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<Span | null> {
  return storage.getSpan(spanId, projectId);
}

export async function querySpans(
  projectId: string,
  filters: SpanQueryFilters,
  storage: StorageAdapter,
): Promise<QuerySpanResult> {
  const result = await storage.querySpans(projectId, filters);

  return {
    spans: result.spans,
    total: result.total,
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  };
}
