import { MAX_OTLP_SPANS_PER_EXPORT, spanSchema, type SpanInput } from "../shared/validation";

const MAX_PAYLOAD_BYTES = 64 * 1024;

interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values?: OtlpAnyValue[] };
  kvlistValue?: { values?: OtlpAttribute[] };
}

interface OtlpAttribute {
  key: string;
  value?: OtlpAnyValue;
}

interface OtlpSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpAttribute[];
  status?: { code?: number; message?: string };
}

export interface OtlpExtractResult {
  spans: SpanInput[];
  rejectedSpans: number;
  errorMessage?: string;
}

/**
 * Attribute keys that are lifted into first-class span fields and therefore
 * excluded from the metadata copy to avoid storing every payload twice.
 */
const FIRST_CLASS_ATTRIBUTE_KEYS = new Set([
  "pulse.trace_id",
  "pulse.session_id",
  "pulse.source",
  "pulse.kind",
  "pulse.event_type",
  "pulse.session_name",
  "pulse.cwd",
  "pulse.model",
  "pulse.is_interrupt",
  "pulse.agent.name",
  "pulse.metadata",
  "pulse.provider",
  "pulse.tool.id",
  "pulse.tool.name",
  "pulse.tool.input",
  "pulse.tool.response",
  "pulse.error",
  "pulse.cost_cents",
  "pulse.output_text",
  "gen_ai.tool.name",
  "gen_ai.tool.input",
  "gen_ai.tool.output",
  "gen_ai.tool.call.id",
  "gen_ai.request.model",
  "gen_ai.response.model",
  "gen_ai.response.id",
  "gen_ai.response.finish_reasons",
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.output_tokens",
  "gen_ai.provider.name",
  "gen_ai.system",
  "gen_ai.conversation.id",
]);

function anyValue(value: OtlpAnyValue | undefined): unknown {
  if (!value) return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return Number(value.intValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values ?? []).map(anyValue);
  }
  if (value.kvlistValue !== undefined) {
    return Object.fromEntries(
      (value.kvlistValue.values ?? []).map((attr) => [
        attr.key,
        anyValue(attr.value),
      ]),
    );
  }
  return undefined;
}

function attrsToMap(attrs: OtlpAttribute[] | undefined): Map<string, unknown> {
  return new Map((attrs ?? []).map((attr) => [attr.key, anyValue(attr.value)]));
}

function valueAttr(attrs: Map<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = attrs.get(key);
    if (value !== undefined) return value;
  }
  return undefined;
}

function stringAttr(attrs: Map<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = attrs.get(key);
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function numberAttr(attrs: Map<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = attrs.get(key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function boolAttr(attrs: Map<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = attrs.get(key);
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

/**
 * gen_ai.response.finish_reasons is an array in the GenAI conventions; accept
 * a bare string, a JSON-encoded array, or fall back to the raw value.
 */
function finishReasonAttr(attrs: Map<string, unknown>): string | undefined {
  const raw = stringAttr(attrs, "gen_ai.response.finish_reasons", "gen_ai.response.finish_reason");
  if (!raw) return undefined;
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    } catch {
      return raw;
    }
  }
  return raw;
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function capPayload(value: unknown): unknown {
  if (value === undefined) return undefined;
  let serialized: string;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    serialized = String(value);
  }

  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes <= MAX_PAYLOAD_BYTES) return value;
  return {
    truncated: true,
    originalBytes: bytes,
    preview: serialized.slice(0, MAX_PAYLOAD_BYTES),
  };
}

function otlpTimeToIso(value: string | number | undefined): string {
  if (value === undefined) return new Date().toISOString();
  try {
    const date = new Date(Number(BigInt(String(value)) / 1_000_000n));
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function durationMs(
  start: string | number | undefined,
  end: string | number | undefined,
): number | undefined {
  if (start === undefined || end === undefined) return undefined;
  try {
    return Number((BigInt(String(end)) - BigInt(String(start))) / 1_000_000n);
  } catch {
    return undefined;
  }
}

function optionalId(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) return undefined;
  return value;
}

function otlpSpanToSpanInput(span: OtlpSpan): SpanInput {
  const attrs = attrsToMap(span.attributes);
  const traceId = stringAttr(attrs, "pulse.trace_id") ?? span.traceId ?? crypto.randomUUID();
  const eventType = stringAttr(attrs, "pulse.event_type") ?? "provider_call";
  const kind =
    stringAttr(attrs, "pulse.kind") ?? (eventType === "provider_call" ? "llm_call" : "tool_use");
  const toolInput = capPayload(
    parsePayload(valueAttr(attrs, "pulse.tool.input", "gen_ai.tool.input")),
  );
  const toolResponse = capPayload(
    parsePayload(valueAttr(attrs, "pulse.tool.response", "gen_ai.tool.output")),
  );
  const metadata: Record<string, unknown> = {};
  const pulseMetadata = valueAttr(attrs, "pulse.metadata");
  if (
    pulseMetadata &&
    typeof pulseMetadata === "object" &&
    !Array.isArray(pulseMetadata)
  ) {
    Object.assign(metadata, pulseMetadata);
  } else if (pulseMetadata !== undefined) {
    metadata["pulse.metadata"] = capPayload(parsePayload(pulseMetadata));
  }
  const sessionName = stringAttr(attrs, "pulse.session_name");
  if (sessionName !== undefined) metadata.session_name = sessionName;
  for (const [key, value] of attrs) {
    if (FIRST_CLASS_ATTRIBUTE_KEYS.has(key)) continue;
    if (key.startsWith("pulse.") || key.startsWith("gen_ai.") || key === "service.name") {
      metadata[key] = capPayload(parsePayload(value));
    }
  }
  const toolName = stringAttr(attrs, "pulse.tool.name", "gen_ai.tool.name");
  const outputText = stringAttr(attrs, "pulse.output_text");

  return {
    span_id: optionalId(span.spanId) ?? crypto.randomUUID(),
    trace_id: traceId,
    session_id: stringAttr(attrs, "pulse.session_id", "gen_ai.conversation.id") ?? traceId,
    parent_span_id: optionalId(span.parentSpanId),
    timestamp: otlpTimeToIso(span.startTimeUnixNano),
    duration_ms: durationMs(span.startTimeUnixNano, span.endTimeUnixNano),
    source: (stringAttr(attrs, "pulse.source") ?? "sdk") as SpanInput["source"],
    kind: kind as SpanInput["kind"],
    event_type: eventType,
    status: span.status?.code === 2 ? "error" : "success",
    tool_use_id: stringAttr(attrs, "pulse.tool.id", "gen_ai.tool.call.id"),
    tool_name: kind === "tool_use" ? (toolName ?? span.name) : undefined,
    tool_input: toolInput,
    tool_response: toolResponse,
    error: capPayload(parsePayload(valueAttr(attrs, "pulse.error", "exception.message"))),
    is_interrupt: boolAttr(attrs, "pulse.is_interrupt"),
    cwd: stringAttr(attrs, "pulse.cwd"),
    model: stringAttr(
      attrs,
      "pulse.model",
      "gen_ai.request.model",
      "gen_ai.response.model",
    ),
    agent_name: stringAttr(attrs, "pulse.agent.name"),
    provider: stringAttr(attrs, "gen_ai.provider.name", "gen_ai.system", "pulse.provider"),
    model_used: stringAttr(attrs, "gen_ai.response.model"),
    input_tokens: numberAttr(attrs, "gen_ai.usage.input_tokens"),
    output_tokens: numberAttr(attrs, "gen_ai.usage.output_tokens"),
    cost_cents: numberAttr(attrs, "pulse.cost_cents"),
    finish_reason: finishReasonAttr(attrs),
    output_text: outputText === undefined ? undefined : capPayloadString(outputText),
    provider_request_id: stringAttr(attrs, "gen_ai.response.id"),
    metadata,
  };
}

function capPayloadString(value: string): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= MAX_PAYLOAD_BYTES) return value;
  return new TextDecoder().decode(bytes.slice(0, MAX_PAYLOAD_BYTES)).replace(/�+$/, "");
}

/**
 * Extract and validate Pulse span inputs from an OTLP JSON traces payload.
 *
 * Malformed individual spans are dropped and counted so the endpoint can
 * report them via OTLP partialSuccess instead of rejecting the whole export.
 */
export function extractOtlpSpans(payload: unknown): OtlpExtractResult {
  if (payload === null || typeof payload !== "object") {
    throw new Error("Missing resourceSpans");
  }
  const resourceSpans = (payload as { resourceSpans?: unknown[] }).resourceSpans;
  if (!Array.isArray(resourceSpans)) {
    throw new Error("Missing resourceSpans");
  }

  const spans: SpanInput[] = [];
  let rejectedSpans = 0;
  let errorMessage: string | undefined;
  let totalSpans = 0;

  for (const resourceSpan of resourceSpans) {
    if (resourceSpan === null || typeof resourceSpan !== "object") continue;
    const scopeSpans = (resourceSpan as { scopeSpans?: unknown[] }).scopeSpans;
    if (!Array.isArray(scopeSpans)) continue;
    for (const scopeSpan of scopeSpans) {
      if (scopeSpan === null || typeof scopeSpan !== "object") continue;
      const rawSpans = (scopeSpan as { spans?: unknown[] }).spans;
      if (!Array.isArray(rawSpans)) continue;
      for (const rawSpan of rawSpans) {
        totalSpans += 1;
        if (totalSpans > MAX_OTLP_SPANS_PER_EXPORT) {
          throw new Error(`Export exceeds ${MAX_OTLP_SPANS_PER_EXPORT} spans`);
        }
        try {
          const parsed = spanSchema.safeParse(otlpSpanToSpanInput(rawSpan as OtlpSpan));
          if (parsed.success) {
            spans.push(parsed.data);
            continue;
          }
          rejectedSpans += 1;
          errorMessage ??= parsed.error.issues[0]?.message;
        } catch (err) {
          rejectedSpans += 1;
          errorMessage ??= err instanceof Error ? err.message : "Malformed span";
        }
      }
    }
  }

  return { spans, rejectedSpans, errorMessage };
}
