import type { StorageAdapter, TraceQueryFilters } from "../db/adapter";
import type { Span } from "../db/schema";

const SPAN_PAGE_SIZE = 500;

export interface SdkTraceSummary {
  traceId: string;
  sessionId: string;
  timestamp: Date | string;
  latencyMs: number;
  provider: string;
  modelRequested: string;
  modelUsed: string;
  providerRequestId: string | undefined;
  requestBody: unknown;
  responseBody: unknown;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  outputText: string | undefined;
  finishReason: string | undefined;
  status: "success" | "error";
  error: unknown;
  costCents: number | undefined;
  metadata: Record<string, unknown>;
  spans: Array<Span & { label: string }>;
}

function spanMetadata(span: Span): Record<string, unknown> {
  return typeof span.metadata === "object" && span.metadata !== null && !Array.isArray(span.metadata)
    ? (span.metadata as Record<string, unknown>)
    : {};
}

function spanLabel(span: Span): string {
  return span.toolName ?? span.eventType ?? span.kind;
}

function sdkProvider(span: Span): string {
  if (span.provider) return span.provider;
  const metadata = spanMetadata(span);
  const provider = metadata["pulse.provider"] ?? metadata.provider ?? metadata["gen_ai.system"];
  return typeof provider === "string" ? provider : "sdk";
}

function timestampMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

/**
 * Derive a dashboard-compatible trace summary from SDK spans sharing a trace_id.
 */
export function deriveTraceSummary(traceId: string, traceSpans: Span[]): SdkTraceSummary {
  const sorted = [...traceSpans].sort(
    (a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp),
  );
  const providerSpan = sorted.find((span) => span.kind === "llm_call") ?? sorted[0]!;
  const metadata = spanMetadata(providerSpan);
  const requestBody = metadata["pulse.request"] ?? metadata.request;
  const responseBody = metadata["pulse.response"] ?? metadata.response;
  const toolIds = new Set(
    sorted
      .filter((span) => span.kind === "tool_use")
      .map((span) => span.toolUseId ?? span.spanId),
  );

  const llmSpans = sorted.filter((span) => span.kind === "llm_call");
  const sumTokens = (select: (span: Span) => number | null | undefined): number | undefined => {
    const values = llmSpans.map(select).filter((value): value is number => value != null);
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
  };

  return {
    traceId,
    sessionId: providerSpan.sessionId,
    timestamp: providerSpan.timestamp,
    latencyMs: sorted.reduce((sum, span) => sum + (span.durationMs ?? 0), 0),
    provider: sdkProvider(providerSpan),
    modelRequested: providerSpan.model ?? "unknown",
    modelUsed: providerSpan.modelUsed ?? providerSpan.model ?? "unknown",
    providerRequestId: providerSpan.providerRequestId ?? undefined,
    requestBody,
    responseBody,
    inputTokens: sumTokens((span) => span.inputTokens),
    outputTokens: sumTokens((span) => span.outputTokens),
    outputText: providerSpan.outputText ?? undefined,
    finishReason: providerSpan.finishReason ?? undefined,
    status: sorted.some((span) => span.status === "error") ? "error" : "success",
    error: sorted.find((span) => span.error)?.error,
    costCents: sumTokens((span) => span.costCents),
    metadata: {
      ...metadata,
      toolCalls: toolIds.size,
    },
    spans: sorted.map((span) => ({
      ...span,
      label: spanLabel(span),
    })),
  };
}

async function queryAllSdkSpans(
  projectId: string,
  storage: StorageAdapter,
  filters: {
    sessionId?: string;
    traceId?: string;
    status?: "success" | "error";
    dateFrom?: Date;
    dateTo?: Date;
  },
): Promise<Span[]> {
  const spans: Span[] = [];
  let offset = 0;

  for (;;) {
    const page = await storage.querySpans(projectId, {
      sessionId: filters.sessionId,
      traceId: filters.traceId,
      source: "sdk",
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: SPAN_PAGE_SIZE,
      offset,
    });
    spans.push(...page.spans);
    if (page.spans.length < SPAN_PAGE_SIZE || spans.length >= page.total) {
      break;
    }
    offset += SPAN_PAGE_SIZE;
  }

  return spans;
}

function groupSpansByTraceId(spans: Span[]): Map<string, Span[]> {
  const groups = new Map<string, Span[]>();
  for (const span of spans) {
    const traceId = span.traceId;
    if (!traceId) continue;
    const group = groups.get(traceId) ?? [];
    group.push(span);
    groups.set(traceId, group);
  }
  return groups;
}

function matchesTraceFilters(
  summary: SdkTraceSummary,
  filters: Pick<TraceQueryFilters, "provider" | "model">,
): boolean {
  if (filters.provider && summary.provider !== filters.provider) return false;
  if (filters.model && summary.modelRequested !== filters.model) return false;
  return true;
}

/**
 * Build all SDK-derived trace summaries for a project matching the given filters.
 */
export async function listSdkTraceSummaries(
  projectId: string,
  storage: StorageAdapter,
  filters: TraceQueryFilters = {},
): Promise<SdkTraceSummary[]> {
  const spans = await queryAllSdkSpans(projectId, storage, {
    sessionId: filters.sessionId,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  return [...groupSpansByTraceId(spans).entries()]
    .map(([traceId, traceSpans]) => deriveTraceSummary(traceId, traceSpans))
    .filter((summary) => matchesTraceFilters(summary, filters))
    .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp));
}

/**
 * Build SDK-derived trace summaries for a single session (ascending by timestamp).
 */
export async function listSdkSessionTraceSummaries(
  sessionId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<SdkTraceSummary[]> {
  const spans = await queryAllSdkSpans(projectId, storage, { sessionId });
  return [...groupSpansByTraceId(spans).entries()]
    .map(([traceId, traceSpans]) => deriveTraceSummary(traceId, traceSpans))
    .sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
}

/**
 * Look up a single SDK-derived trace by id, or null if no matching spans exist.
 */
export async function getSdkTraceSummary(
  traceId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<SdkTraceSummary | null> {
  const spans = await queryAllSdkSpans(projectId, storage, { traceId });
  if (spans.length === 0) return null;
  return deriveTraceSummary(traceId, spans);
}

/**
 * Merge legacy traces with SDK-derived summaries, then apply offset/limit.
 */
export function mergeTracePages<T extends { timestamp: Date | string | number }>(
  sdkTraces: T[],
  legacyTraces: T[],
  filters: { limit?: number; offset?: number },
): { traces: T[]; total: number; limit: number; offset: number } {
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;
  const combined = [...sdkTraces, ...legacyTraces].sort(
    (a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp),
  );

  return {
    traces: combined.slice(offset, offset + limit),
    total: combined.length,
    limit,
    offset,
  };
}
