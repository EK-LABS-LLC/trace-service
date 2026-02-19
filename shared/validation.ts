import { z } from "zod";

/**
 * Provider schema - accepts only specific provider values
 */
export const providerSchema = z.enum(["openai", "anthropic", "openrouter"]);

/**
 * Status enum for trace status
 */
export const statusSchema = z.enum(["success", "error"]);

/**
 * Trace validation schema for incoming trace data
 */
export const traceSchema = z.object({
  trace_id: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }),
  provider: providerSchema,
  model_requested: z.string().min(1),
  model_used: z.string().optional(),
  provider_request_id: z.string().optional(),
  request_body: z.record(z.string(), z.unknown()),
  response_body: z.record(z.string(), z.unknown()).optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  output_text: z.string().optional(),
  finish_reason: z.string().optional(),
  status: statusSchema,
  error: z.record(z.string(), z.unknown()).optional(),
  latency_ms: z.number().nonnegative(),
  cost_cents: z.number().nonnegative().optional(),
  session_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Batch trace schema - array of traces with max 100 items
 */
export const batchTraceSchema = z.array(traceSchema).max(100);

/**
 * Query params schema for GET /v1/traces
 */
export const traceQuerySchema = z.object({
  session_id: z.string().uuid().optional(),
  provider: providerSchema.optional(),
  model: z.string().optional(),
  status: statusSchema.optional(),
  date_from: z.union([z.string(), z.coerce.number()]).optional(),
  date_to: z.union([z.string(), z.coerce.number()]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Group by options for analytics aggregation
 */
export const groupBySchema = z.enum(["day", "hour", "model", "provider"]);

/**
 * Query params schema for GET /v1/analytics
 */
export const analyticsQuerySchema = z.object({
  date_from: z.string().datetime({ offset: true }),
  date_to: z.string().datetime({ offset: true }),
  group_by: groupBySchema.optional(),
});

export const spanAnalyticsGroupBySchema = z.enum(["day", "hour"]);

export const spanAnalyticsQuerySchema = z.object({
  date_from: z.string().datetime({ offset: true }),
  date_to: z.string().datetime({ offset: true }),
  group_by: spanAnalyticsGroupBySchema.optional(),
});

/**
 * Source identifies which CLI tool produced the span.
 */
export const spanSourceSchema = z.enum([
  "claude_code",
  "opencode",
  "openclaw",
]);

/**
 * Span kind categorizes what the span represents.
 *
 * tool_use        - agent executed a tool (bash, file edit, search, etc.)
 * agent_run       - a subagent started and completed a task
 * session         - session lifecycle event (start, end, stop, resume)
 * user_prompt     - user submitted a prompt to the agent
 * notification    - agent emitted a notification
 */
export const spanKindSchema = z.enum([
  "tool_use",
  "agent_run",
  "session",
  "user_prompt",
  "notification",
]);

/**
 * Span validation schema for incoming agent event data.
 *
 * A Span represents a single event in an agent's execution — a tool call,
 * a subagent run, a session lifecycle event, etc. Spans are the agent-layer
 * complement to Traces (which represent LLM API calls).
 *
 * Produced by CLI tool hooks.
 */
export const spanSchema = z.object({
  /** Unique identifier for this span. */
  span_id: z.string().uuid(),

  /** Groups spans into a conversation or agent run. Provided by the source tool. */
  session_id: z.string().min(1),

  /** Parent span for building hierarchy (agent_run -> tool_use -> nested tool_use). */
  parent_span_id: z.string().uuid().optional(),

  /** When this event occurred. */
  timestamp: z.string().datetime({ offset: true }),

  /** Duration of the span in milliseconds (e.g. tool execution time). Null for instant events. */
  duration_ms: z.number().nonnegative().optional(),

  /** Which tool or SDK produced this span. */
  source: spanSourceSchema,

  /** What category of event this span represents. */
  kind: spanKindSchema,

  /** The specific event type from the source (e.g. "pre_tool_use", "post_tool_use", "stop"). */
  event_type: z.string().min(1),

  /** Whether this event completed successfully. */
  status: statusSchema,

  // ── tool execution fields ──────────────────────────────────────────

  /** Correlation ID linking pre and post tool events into a single tool execution. */
  tool_use_id: z.string().optional(),

  /** Name of the tool (e.g. "Bash", "Edit", "Read", "WebSearch"). */
  tool_name: z.string().optional(),

  /** Arguments/input sent to the tool. */
  tool_input: z.unknown().optional(),

  /** Output returned by the tool. */
  tool_response: z.unknown().optional(),

  // ── error fields ───────────────────────────────────────────────────

  /** Error message or object when status is "error". */
  error: z.unknown().optional(),

  /** Whether the error was caused by a user interrupt (e.g. ctrl+c). */
  is_interrupt: z.boolean().optional(),

  // ── context fields ─────────────────────────────────────────────────

  /** Working directory when the event fired. Tells you which project. */
  cwd: z.string().optional(),

  /** Model active during this session. */
  model: z.string().optional(),

  /** Subagent type for agent_run spans (e.g. "Bash", "Explore", "Plan"). */
  agent_name: z.string().optional(),

  /** Arbitrary additional data. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Batch span schema - array of spans with max 100 items
 */
export const batchSpanSchema = z.array(spanSchema).max(100);

/**
 * Query params schema for GET /v1/spans
 */
export const spanQuerySchema = z.object({
  session_id: z.string().optional(),
  source: spanSourceSchema.optional(),
  kind: spanKindSchema.optional(),
  tool_name: z.string().optional(),
  status: statusSchema.optional(),
  date_from: z.union([z.string(), z.coerce.number()]).optional(),
  date_to: z.union([z.string(), z.coerce.number()]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Inferred TypeScript types from schemas
 */
export type Provider = z.infer<typeof providerSchema>;
export type TraceStatus = z.infer<typeof statusSchema>;
export type TraceInput = z.infer<typeof traceSchema>;
export type BatchTraceInput = z.infer<typeof batchTraceSchema>;
export type TraceQueryParams = z.infer<typeof traceQuerySchema>;
export type GroupBy = z.infer<typeof groupBySchema>;
export type AnalyticsQueryParams = z.infer<typeof analyticsQuerySchema>;
export type SpanAnalyticsGroupBy = z.infer<typeof spanAnalyticsGroupBySchema>;
export type SpanAnalyticsQueryParams = z.infer<typeof spanAnalyticsQuerySchema>;

export type SpanSource = z.infer<typeof spanSourceSchema>;
export type SpanKind = z.infer<typeof spanKindSchema>;
export type SpanInput = z.infer<typeof spanSchema>;
export type BatchSpanInput = z.infer<typeof batchSpanSchema>;
export type SpanQueryParams = z.infer<typeof spanQuerySchema>;
