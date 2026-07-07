import type { StorageAdapter, SpanQueryFilters } from "../db/adapter";
import type { Span, NewSpan } from "../db/schema";
import { batchSpanSchema, type SpanInput } from "../shared/validation";
import { legacySpanToOtelSpan, refreshTraceSummary } from "./otel";

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

async function toNewSpan(
  input: SpanInput,
  projectId: string,
  storage: StorageAdapter,
): Promise<NewSpan> {
  const otelSpan = await legacySpanToOtelSpan(projectId, input, storage);
  return {
    ...otelSpan,
    projectId,
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
    const newSpan = await toNewSpan(spanInput, projectId, storage);
    const inserted = await storage.insertSpan(projectId, newSpan);
    if (inserted.traceId) {
      await refreshTraceSummary(projectId, inserted.traceId, storage);
    }
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
    const newSpan = await toNewSpan(spanInput, projectId, storage);
    const inserted = await storage.insertSpanIdempotent(projectId, newSpan);
    if (inserted.traceId) {
      await refreshTraceSummary(projectId, inserted.traceId, storage);
    }
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
