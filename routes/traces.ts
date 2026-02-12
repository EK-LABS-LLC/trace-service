import type { Context } from "hono";
import { storage } from "../db/postgres";
import { ingestTraces, queryTraces, getTrace } from "../services/traces";
import { ZodError } from "zod";
import { traceQuerySchema, batchTraceSchema } from "../shared/validation";
import type { TraceInput } from "../shared/validation";
import { getEventBus } from "../event-bus/client";
import { buildTraceIngestSubject } from "../event-bus/subjects";

/**
 * Handler for POST /v1/traces/batch
 * Ingests a batch of traces for the authenticated project.
 */
export async function handleBatchTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const result = await ingestTraces(projectId, body, storage);
    return c.json(result, 202);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", details: err.issues }, 400);
    }
    throw err;
  }
}

/**
 * Handler for POST /v1/traces/async
 * Publishes traces to the NATS stream for asynchronous processing.
 */
export async function handleAsyncTrace(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  let traces: TraceInput[];
  try {
    traces = batchTraceSchema.parse(payload);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", details: err.issues }, 400);
    }
    throw err;
  }

  try {
    await getEventBus().publish(buildTraceIngestSubject(projectId), {
      projectId,
      traces,
    });
    return c.json({ status: "queued", count: traces.length }, 202);
  } catch (err) {
    console.error("Failed to publish trace event", err);
    return c.json({ error: "Failed to enqueue trace" }, 503);
  }
}

/**
 * Handler for GET /v1/traces
 * Query traces for the authenticated project with optional filters.
 */
export async function getTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  const rawQuery = c.req.query();
  let params;
  try {
    params = traceQuerySchema.parse(rawQuery);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json({ error: "Invalid query parameters", details: err.issues }, 400);
    }
    throw err;
  }

  const parseDateParam = (value: string | number | undefined, boundary: "start" | "end"): Date | undefined => {
    if (value === undefined) return undefined;

    if (typeof value === "number") {
      const ms = value < 1_000_000_000_000 ? value * 1000 : value;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const trimmed = value.trim();
    if (!trimmed) return undefined;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const iso = boundary === "start"
        ? `${trimmed}T00:00:00.000Z`
        : `${trimmed}T23:59:59.999Z`;
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    // Numeric string (epoch seconds or ms)
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1_000_000_000_000 ? num * 1000 : num;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    // ISO-ish datetime string
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const dateFrom = parseDateParam(params.date_from, "start");
  const dateTo = parseDateParam(params.date_to, "end");
  if (params.date_from !== undefined && !dateFrom) {
    return c.json({ error: "Invalid date_from parameter" }, 400);
  }
  if (params.date_to !== undefined && !dateTo) {
    return c.json({ error: "Invalid date_to parameter" }, 400);
  }

  const filters = {
    sessionId: params.session_id,
    provider: params.provider,
    model: params.model,
    status: params.status,
    dateFrom,
    dateTo,
    limit: params.limit,
    offset: params.offset,
  };

  const result = await queryTraces(projectId, filters, storage);
  return c.json(result, 200);
}

/**
 * Handler for GET /v1/traces/:id
 * Get a single trace by ID for the authenticated project.
 */
export async function getTraceById(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const traceId = c.req.param("id");

  const trace = await getTrace(traceId, projectId, storage);

  if (!trace) {
    return c.json({ error: "Trace not found" }, 404);
  }

  return c.json(trace, 200);
}
