import { createHash } from "node:crypto";
import type { StorageAdapter } from "../db/adapter";
import type { NewSpan, NewTraceSummary, Span } from "../db/schema";
import type { SpanInput, TraceInput } from "../shared/validation";

type AttributeValue = string | number | boolean | null | AttributeValue[] | { [key: string]: AttributeValue };
type AttributeMap = Record<string, AttributeValue>;

interface OtlpAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string | number;
  doubleValue?: number;
  bytesValue?: string;
  arrayValue?: { values?: OtlpAnyValue[] };
  kvlistValue?: { values?: Array<{ key: string; value: OtlpAnyValue }> };
}

interface OtlpAttribute {
  key: string;
  value: OtlpAnyValue;
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name?: string;
  kind?: string | number;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpAttribute[];
  events?: unknown[];
  links?: unknown[];
  status?: { code?: string | number; message?: string };
}

interface OtlpPayload {
  resourceSpans?: Array<{
    resource?: { attributes?: OtlpAttribute[] };
    scopeSpans?: Array<{
      scope?: Record<string, unknown>;
      spans?: OtlpSpan[];
    }>;
  }>;
}

export interface OtlpIngestResult {
  count: number;
  traceCount: number;
}

function hashHex(input: string, length: number): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

export function toOtelTraceId(value: string): string {
  const normalized = value.replaceAll("-", "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(normalized) ? normalized : hashHex(value, 32);
}

export function toOtelSpanId(value: string): string {
  const normalized = value.replaceAll("-", "").toLowerCase();
  return /^[0-9a-f]{16}$/.test(normalized) ? normalized : hashHex(value, 16);
}

function anyValueToJson(value: OtlpAnyValue | undefined): AttributeValue {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.intValue !== undefined) {
    const numeric = Number(value.intValue);
    return Number.isFinite(numeric) ? numeric : String(value.intValue);
  }
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.bytesValue !== undefined) return value.bytesValue;
  if (value.arrayValue) {
    return (value.arrayValue.values ?? []).map((entry) => anyValueToJson(entry));
  }
  if (value.kvlistValue) {
    return Object.fromEntries(
      (value.kvlistValue.values ?? []).map((entry) => [entry.key, anyValueToJson(entry.value)]),
    );
  }
  return null;
}

function attributesToObject(attributes: OtlpAttribute[] | undefined): AttributeMap {
  const result: AttributeMap = {};
  for (const attribute of attributes ?? []) {
    result[attribute.key] = anyValueToJson(attribute.value);
  }
  return result;
}

function toUnixNanoString(date: Date): string {
  return `${BigInt(date.getTime()) * 1_000_000n}`;
}

function dateFromUnixNano(value: string | number | undefined): Date {
  if (value === undefined) return new Date();
  try {
    const millis = BigInt(String(value)) / 1_000_000n;
    return new Date(Number(millis));
  } catch {
    return new Date();
  }
}

function numberAttribute(attributes: AttributeMap, keys: string[]): number {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return 0;
}

function stringAttribute(attributes: AttributeMap, keys: string[]): string | null {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return objectValue(parsed);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncateText(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function extractMessageContent(message: unknown): string | null {
  const obj = objectValue(message);
  if (!obj) return null;
  const content = obj.content;
  if (typeof content === "string") return stringValue(content);
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === "string") return part;
        const partObj = objectValue(part);
        if (!partObj) return null;
        return stringValue(partObj.text) ?? stringValue(partObj.content);
      })
      .filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return null;
}

function promptPreviewFromRequestBody(requestBody: unknown): string | null {
  const body = objectValue(requestBody);
  if (!body) return null;
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (messages) {
    const userMessage =
      [...messages].reverse().find((message) => objectValue(message)?.role === "user") ??
      messages[messages.length - 1];
    const content = extractMessageContent(userMessage);
    if (content) return truncateText(content);
  }
  const prompt = stringValue(body.prompt) ?? stringValue(body.input);
  return prompt ? truncateText(prompt) : null;
}

function promptPreviewFromSpan(span: Span): string | null {
  const attributes = (objectValue(span.attributes) ?? {}) as AttributeMap;
  const fromAttributes = stringAttribute(attributes, [
    "pulse.prompt",
    "pulse.prompt.preview",
    "gen_ai.prompt",
    "input.value",
  ]);
  if (fromAttributes) return truncateText(fromAttributes);

  const metadata = objectValue(span.metadata);
  const prompt = stringValue(metadata?.prompt);
  if (prompt) return truncateText(prompt);

  const requestBody = objectValue(metadata?.requestBody);
  return promptPreviewFromRequestBody(requestBody);
}

function collectStringFromSpans(spans: Span[], keys: string[]): string | null {
  for (const span of spans) {
    const attributes = (objectValue(span.attributes) ?? {}) as AttributeMap;
    const value = stringAttribute(attributes, keys);
    if (value) return value;
    const metadata = objectValue(span.metadata);
    for (const key of keys) {
      const metadataValue = stringValue(metadata?.[key]);
      if (metadataValue) return metadataValue;
    }
  }
  return null;
}

function deriveTraceDisplay(sorted: Span[], root: Span): {
  name: string;
  attributes: AttributeMap;
} {
  const provider =
    collectStringFromSpans(sorted, ["gen_ai.provider.name", "gen_ai.system", "pulse.provider"]) ??
    stringAttribute((objectValue(root.attributes) ?? {}) as AttributeMap, [
      "gen_ai.provider.name",
      "gen_ai.system",
      "pulse.provider",
    ]);
  const model =
    collectStringFromSpans(sorted, ["gen_ai.response.model", "gen_ai.request.model"]) ??
    root.model ??
    null;
  const sessionName = collectStringFromSpans(sorted, [
    "pulse.session.name",
    "session.name",
    "thread.name",
    "conversation.name",
  ]);
  const explicitTraceName = collectStringFromSpans(sorted, [
    "pulse.trace.name",
    "trace.name",
    "operation.name",
    "eval.case.name",
  ]);
  const promptPreview =
    sorted.find((span) => span.eventType === "user_prompt_submit" || span.kind === "user_prompt")
      ? promptPreviewFromSpan(
          sorted.find((span) => span.eventType === "user_prompt_submit" || span.kind === "user_prompt")!,
        )
      : sorted.map(promptPreviewFromSpan).find((value): value is string => !!value) ?? null;

  const toolCallCount = sorted.filter((span) => span.kind === "tool_use").length;
  const agentRunCount = sorted.filter((span) => span.kind === "agent_run").length;
  const fallbackName = root.name ?? root.eventType ?? "trace";
  const name =
    explicitTraceName ??
    promptPreview ??
    (root.source === "sdk" && provider && model ? `${provider}/${model}` : null) ??
    fallbackName;

  return {
    name: truncateText(name, 140),
    attributes: {
      "pulse.session_id": root.sessionId,
      "pulse.source": root.source,
      "pulse.session.name": sessionName,
      "pulse.trace.name": explicitTraceName,
      "pulse.prompt.preview": promptPreview,
      "pulse.display.name": truncateText(name, 140),
      "pulse.tool_call_count": toolCallCount,
      "pulse.agent_run_count": agentRunCount,
      "gen_ai.provider.name": provider,
      "gen_ai.request.model": model,
    },
  };
}

function statusFromOtel(status: OtlpSpan["status"]): "success" | "error" {
  const code = String(status?.code ?? "").toUpperCase();
  return code === "2" || code === "ERROR" || code === "STATUS_CODE_ERROR" ? "error" : "success";
}

function sourceFromAttributes(attributes: AttributeMap, resource: AttributeMap): string {
  const source = attributes["pulse.source"] ?? resource["service.name"];
  return typeof source === "string" && source.trim() ? source : "otel";
}

function sessionFromAttributes(attributes: AttributeMap, resource: AttributeMap): string | null {
  const sessionId =
    attributes["pulse.session_id"] ??
    attributes["pulse.session.id"] ??
    attributes["session.id"] ??
    resource["pulse.session_id"] ??
    resource["pulse.session.id"] ??
    null;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId : null;
}

function kindFromOtel(kind: string | number | undefined): string {
  if (typeof kind === "string" && kind.trim()) return kind.toLowerCase();
  switch (kind) {
    case 1:
      return "internal";
    case 2:
      return "server";
    case 3:
      return "client";
    case 4:
      return "producer";
    case 5:
      return "consumer";
    default:
      return "internal";
  }
}

async function ensureSession(
  projectId: string,
  sessionId: string | null,
  storage: StorageAdapter,
): Promise<void> {
  if (sessionId) {
    await storage.upsertSession(projectId, {
      id: sessionId,
      projectId,
      metadata: { source: "otel" },
    });
  }
}

export async function insertOtelSpan(
  projectId: string,
  span: NewSpan,
  storage: StorageAdapter,
): Promise<Span> {
  const inserted = await storage.insertSpanIdempotent(projectId, span);
  if (inserted.traceId) {
    await refreshTraceSummary(projectId, inserted.traceId, storage);
  }
  return inserted;
}

export async function ingestOtlpJson(
  projectId: string,
  payload: unknown,
  storage: StorageAdapter,
): Promise<OtlpIngestResult> {
  const body = payload as OtlpPayload;
  if (!Array.isArray(body.resourceSpans)) {
    throw new Error("Invalid OTLP JSON payload: resourceSpans is required");
  }

  let count = 0;
  const traceIds = new Set<string>();
  for (const resourceSpan of body.resourceSpans) {
    const resource = attributesToObject(resourceSpan.resource?.attributes);
    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      const scope = scopeSpan.scope ?? {};
      for (const otlpSpan of scopeSpan.spans ?? []) {
        if (!otlpSpan.traceId || !otlpSpan.spanId) continue;
        const attributes = attributesToObject(otlpSpan.attributes);
        const traceId = toOtelTraceId(otlpSpan.traceId);
        const spanId = toOtelSpanId(otlpSpan.spanId);
        const start = dateFromUnixNano(otlpSpan.startTimeUnixNano);
        const end = dateFromUnixNano(otlpSpan.endTimeUnixNano ?? otlpSpan.startTimeUnixNano);
        const sessionId = sessionFromAttributes(attributes, resource);
        const source = sourceFromAttributes(attributes, resource);
        const status = statusFromOtel(otlpSpan.status);

        await ensureSession(projectId, sessionId, storage);
        await insertOtelSpan(
          projectId,
          {
            spanId,
            traceId,
            projectId,
            sessionId: sessionId ?? traceId,
            parentSpanId: otlpSpan.parentSpanId ? toOtelSpanId(otlpSpan.parentSpanId) : undefined,
            name: otlpSpan.name ?? "otel.span",
            otelKind: kindFromOtel(otlpSpan.kind),
            startTimeUnixNano: String(otlpSpan.startTimeUnixNano ?? toUnixNanoString(start)),
            endTimeUnixNano: String(otlpSpan.endTimeUnixNano ?? toUnixNanoString(end)),
            statusCode: String(otlpSpan.status?.code ?? (status === "error" ? "ERROR" : "OK")),
            statusMessage: otlpSpan.status?.message,
            attributes,
            events: otlpSpan.events,
            links: otlpSpan.links,
            resource,
            scope,
            timestamp: start,
            durationMs: Math.max(0, end.getTime() - start.getTime()),
            source,
            kind:
              attributes["pulse.event.kind"]?.toString() ??
              attributes["pulse.kind"]?.toString() ??
              attributes["pulse.span.type"]?.toString() ??
              "otel",
            eventType:
              attributes["pulse.event.type"]?.toString() ??
              attributes["pulse.event_type"]?.toString() ??
              otlpSpan.name ??
              "otel.span",
            status,
            metadata: { otel: true },
          },
          storage,
        );
        traceIds.add(traceId);
        count += 1;
      }
    }
  }

  return { count, traceCount: traceIds.size };
}

export async function legacyTraceToOtelSpan(
  projectId: string,
  trace: TraceInput,
  storage: StorageAdapter,
): Promise<void> {
  const traceId = toOtelTraceId(trace.trace_id);
  const spanId = toOtelSpanId(`${trace.trace_id}:provider`);
  const sessionId = trace.session_id ?? trace.trace_id;
  const start = new Date(trace.timestamp);
  const end = new Date(start.getTime() + trace.latency_ms);
  const attributes: AttributeMap = {
    "pulse.session_id": sessionId,
    "pulse.source": "sdk",
    "pulse.kind": "llm_call",
    "gen_ai.provider.name": trace.provider,
    "gen_ai.request.model": trace.model_requested,
    "gen_ai.response.model": trace.model_used ?? null,
    "gen_ai.usage.input_tokens": trace.input_tokens ?? 0,
    "gen_ai.usage.output_tokens": trace.output_tokens ?? 0,
    "pulse.cost_cents": trace.cost_cents ?? 0,
  };
  const metadata = objectValue(trace.metadata);
  for (const key of ["pulse.session.name", "pulse.trace.name", "session.name", "trace.name"]) {
    const value = stringValue(metadata?.[key]);
    if (value) attributes[key] = value;
  }
  const promptPreview = promptPreviewFromRequestBody(trace.request_body);
  if (promptPreview) attributes["pulse.prompt.preview"] = promptPreview;

  await ensureSession(projectId, sessionId, storage);
  await insertOtelSpan(
    projectId,
    {
      spanId,
      traceId,
      projectId,
      sessionId,
      name: `${trace.provider}.${trace.model_requested}`,
      otelKind: "client",
      startTimeUnixNano: toUnixNanoString(start),
      endTimeUnixNano: toUnixNanoString(end),
      statusCode: trace.status === "error" ? "ERROR" : "OK",
      statusMessage: trace.error ? JSON.stringify(trace.error) : undefined,
      attributes,
      timestamp: start,
      durationMs: trace.latency_ms,
      source: "sdk",
      kind: "llm_call",
      eventType: "provider_request",
      status: trace.status,
      model: trace.model_used ?? trace.model_requested,
      error: trace.error,
      metadata: {
        legacyTraceId: trace.trace_id,
        requestBody: trace.request_body,
        responseBody: trace.response_body,
        outputText: trace.output_text,
        finishReason: trace.finish_reason,
        ...(trace.metadata ?? {}),
      },
    },
    storage,
  );
}

export async function legacySpanToOtelSpan(
  projectId: string,
  span: SpanInput,
  storage: StorageAdapter,
): Promise<NewSpan> {
  const start = new Date(span.timestamp);
  const end = new Date(start.getTime() + (span.duration_ms ?? 0));
  const traceId = span.trace_id
    ? toOtelTraceId(span.trace_id)
    : await inferTraceIdForLegacySpan(projectId, span, storage);
  const attributes: AttributeMap = {
    "pulse.legacy_span_id": span.span_id,
    "pulse.session_id": span.session_id,
    "pulse.source": span.source,
    "pulse.kind": span.kind,
    "pulse.event_type": span.event_type,
    "pulse.cwd": span.cwd ?? null,
    "gen_ai.request.model": span.model ?? null,
    "gen_ai.tool.name": span.tool_name ?? null,
    "gen_ai.tool.call.id": span.tool_use_id ?? null,
  };
  const metadata = objectValue(span.metadata);
  for (const key of ["pulse.session.name", "pulse.trace.name", "session.name", "trace.name"]) {
    const value = stringValue(metadata?.[key]);
    if (value) attributes[key] = value;
  }
  const prompt = stringValue(metadata?.prompt);
  if (prompt) attributes["pulse.prompt.preview"] = truncateText(prompt);

  await ensureSession(projectId, span.session_id, storage);
  return {
    spanId: span.span_id,
    traceId,
    projectId,
    sessionId: span.session_id,
    parentSpanId: span.parent_span_id,
    name: span.tool_name ?? span.agent_name ?? span.event_type,
    otelKind: span.kind === "tool_use" ? "client" : "internal",
    startTimeUnixNano: toUnixNanoString(start),
    endTimeUnixNano: toUnixNanoString(end),
    statusCode: span.status === "error" ? "ERROR" : "OK",
    statusMessage: span.error ? JSON.stringify(span.error) : undefined,
    attributes,
    timestamp: start,
    durationMs: span.duration_ms,
    source: span.source,
    kind: span.kind,
    eventType: span.event_type,
    status: span.status,
    toolUseId: span.tool_use_id,
    toolName: span.tool_name,
    toolInput: span.tool_input,
    toolResponse: span.tool_response,
    error: span.error,
    isInterrupt: span.is_interrupt,
    cwd: span.cwd,
    model: span.model,
    agentName: span.agent_name,
    metadata: span.metadata,
  };
}

async function inferTraceIdForLegacySpan(
  projectId: string,
  span: SpanInput,
  storage: StorageAdapter,
): Promise<string> {
  if (span.event_type === "user_prompt_submit") {
    return toOtelTraceId(`${projectId}:${span.session_id}:${span.span_id}:agent.turn`);
  }

  const latest = await storage.getLatestTraceSummaryForSession(span.session_id, projectId, span.source);
  if (latest && latest.name !== "agent.session_lifecycle") {
    return latest.traceId;
  }

  return toOtelTraceId(`${projectId}:${span.session_id}:${span.source}:agent.session_lifecycle`);
}

export async function refreshTraceSummary(
  projectId: string,
  traceId: string,
  storage: StorageAdapter,
): Promise<void> {
  const traceSpans = await storage.getTraceSpans(traceId, projectId);
  if (traceSpans.length === 0) return;

  const sorted = [...traceSpans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const root =
    sorted.find((span) => !span.parentSpanId || !sorted.some((candidate) => candidate.spanId === span.parentSpanId)) ??
    sorted[0];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startedAt = new Date(first.timestamp);
  const endedAt = new Date(
    Math.max(
      ...sorted.map((span) => {
        const start = new Date(span.timestamp).getTime();
        return start + (span.durationMs ?? 0);
      }),
      new Date(last.timestamp).getTime(),
    ),
  );
  const errorCount = sorted.filter((span) => span.status === "error").length;
  const inputTokens = sorted.reduce(
    (sum, span) => sum + numberAttribute((span.attributes ?? {}) as AttributeMap, ["gen_ai.usage.input_tokens"]),
    0,
  );
  const outputTokens = sorted.reduce(
    (sum, span) => sum + numberAttribute((span.attributes ?? {}) as AttributeMap, ["gen_ai.usage.output_tokens"]),
    0,
  );
  const costCents = sorted.reduce(
    (sum, span) =>
      sum +
      numberAttribute((span.attributes ?? {}) as AttributeMap, [
        "pulse.cost_cents",
        "pulse.cost.cents",
      ]),
    0,
  );

  const display = deriveTraceDisplay(sorted, root);

  const summary: NewTraceSummary = {
    traceId,
    projectId,
    sessionId: root.sessionId,
    rootSpanId: root.spanId,
    name: display.name,
    source: root.source,
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
    status: errorCount > 0 ? "error" : "success",
    spanCount: sorted.length,
    errorCount,
    inputTokens,
    outputTokens,
    costCents,
    attributes: display.attributes,
  };

  await storage.upsertTraceSummary(projectId, summary);
}
