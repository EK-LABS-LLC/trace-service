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
