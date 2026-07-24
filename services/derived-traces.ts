import type {
  StorageAdapter,
  TraceQueryFilters,
  SpanQueryFilters,
} from "../db/adapter";
import type { Span } from "../db/schema";

const SPAN_PAGE_SIZE = 500;

export interface TraceSummary {
  traceId: string;
  sessionId: string;
  timestamp: Date | string;
  latencyMs: number;
  source: string;
  spanCount: number;
  summary: string;
  toolCallCount: number;
  filesEdited: number;
  provider: string | null;
  modelRequested: string | null;
  modelUsed: string | null;
  providerRequestId: string | undefined;
  requestBody: unknown;
  responseBody: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  outputText: string | undefined;
  finishReason: string | undefined;
  status: "success" | "error";
  error: unknown;
  costCents: number | null;
  metadata: Record<string, unknown>;
  spans: Array<Span & { label: string }>;
}

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

function spanMetadata(span: Span): Record<string, unknown> {
  return typeof span.metadata === "object" &&
    span.metadata !== null &&
    !Array.isArray(span.metadata)
    ? (span.metadata as Record<string, unknown>)
    : {};
}

function spanLabel(span: Span): string {
  return span.toolName ?? span.eventType ?? span.kind;
}

function sdkProvider(span: Span): string {
  if (span.provider) return span.provider;
  const metadata = spanMetadata(span);
  const provider =
    metadata["pulse.provider"] ??
    metadata.provider ??
    metadata["gen_ai.system"];
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
export function deriveTraceSummary(
  traceId: string,
  traceSpans: Span[],
): TraceSummary {
  const sorted = [...traceSpans].sort(
    (a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp),
  );
  const providerSpan =
    sorted.find((span) => span.kind === "llm_call") ?? sorted[0]!;
  const metadata = spanMetadata(providerSpan);
  const requestBody = metadata["pulse.request"] ?? metadata.request;
  const responseBody = metadata["pulse.response"] ?? metadata.response;
  const toolIds = new Set(
    sorted
      .filter((span) => span.kind === "tool_use")
      .map((span) => span.toolUseId ?? span.spanId),
  );

  const isLlm = sorted.some((span) => span.kind === "llm_call");
  const toolSpans = sorted.filter((span) => span.kind === "tool_use");
  const toolCallCount = new Set(
    toolSpans.map((span) => span.toolUseId ?? span.spanId),
  ).size;
  const filesEdited = new Set(
    toolSpans
      .map(editedFilePath)
      .filter((path): path is string => path !== undefined),
  ).size;
  const model = providerSpan.model ?? "unknown";

  const llmSpans = sorted.filter((span) => span.kind === "llm_call");
  const sumTokens = (
    select: (span: Span) => number | null | undefined,
  ): number | undefined => {
    const values = llmSpans
      .map(select)
      .filter((value): value is number => value != null);
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0)
      : undefined;
  };

  return {
    traceId,
    sessionId: providerSpan.sessionId,
    timestamp: providerSpan.timestamp,
    latencyMs: sorted.reduce((sum, span) => sum + (span.durationMs ?? 0), 0),
    source: providerSpan.source,
    spanCount: sorted.length,
    summary: buildSummary(isLlm, model, toolCallCount, filesEdited),
    toolCallCount,
    filesEdited,
    providerRequestId: providerSpan.providerRequestId ?? undefined,
    outputText: providerSpan.outputText ?? undefined,
    finishReason: providerSpan.finishReason ?? undefined,
    status: sorted.some((span) => span.status === "error")
      ? "error"
      : "success",
    error: sorted.find((span) => span.error)?.error,
    metadata: {
      ...metadata,
      toolCalls: toolIds.size,
    },
    spans: sorted.map((span) => ({
      ...span,
      label: spanLabel(span),
    })),
    // LLM fields become null (not undefined) for agent traces:
    provider: isLlm ? sdkProvider(providerSpan) : null,
    modelRequested: isLlm ? model : null,
    modelUsed: isLlm ? (providerSpan.modelUsed ?? model) : null,
    inputTokens: isLlm ? (sumTokens((span) => span.inputTokens) ?? null) : null,
    outputTokens: isLlm
      ? (sumTokens((span) => span.outputTokens) ?? null)
      : null,
    costCents: isLlm ? (sumTokens((span) => span.costCents) ?? null) : null,
    requestBody: isLlm ? requestBody : null,
    responseBody: isLlm ? responseBody : null,
  };
}

async function queryAllSpans(
  projectId: string,
  storage: StorageAdapter,
  filters: {
    sessionId?: string;
    traceId?: string;
    source?: string;
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
      source: filters.source as SpanQueryFilters["source"],
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

/** Fetch a bounded page of traces (all sources) while grouping/counting in storage. */
export async function queryTraceSummaries(
  projectId: string,
  storage: StorageAdapter,
  filters: TraceQueryFilters = {},
): Promise<{ traces: TraceSummary[]; total: number }> {
  const page = await storage.queryTraceIds(projectId, filters);
  const traces = (
    await Promise.all(
      page.traceIds.map((traceId) =>
        getTraceSummary(traceId, projectId, storage),
      ),
    )
  ).filter((summary): summary is TraceSummary => summary !== null);
  return { traces, total: page.total };
}

/**
 * Build trace summaries for a single session, across all sources (ascending by timestamp).
 */
export async function listSessionTraceSummaries(
  sessionId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<TraceSummary[]> {
  const spans = await queryAllSpans(projectId, storage, { sessionId });
  const traceSpans = spans.filter(
    (span) =>
      span.eventType !== "session_start" && span.eventType !== "session_end",
  );
  return [...groupSpansByTraceId(traceSpans).entries()]
    .map(([traceId, traceSpans]) => deriveTraceSummary(traceId, traceSpans))
    .sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
}

/**
 * Look up a single span-derived trace by id, or null if no matching spans exist.
 */
export async function getTraceSummary(
  traceId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<TraceSummary | null> {
  const spans = await queryAllSpans(projectId, storage, { traceId });
  if (spans.length === 0) return null;
  return deriveTraceSummary(traceId, spans);
}
