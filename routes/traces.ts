import type { Context } from "hono";
import { storage } from "../db";
import {
  getTraceSummary,
  queryTraceSummaries,
} from "../services/derived-traces";
import { extractOtlpSpans } from "../lib/otlp";
import { ZodError } from "zod";
import { traceQuerySchema } from "../shared/validation";
import { getSpanEventBus } from "../event-bus/client";
import { buildSpanIngestSubject } from "../event-bus/subjects";

/**
 * Handler for POST /v1/traces
 * Accepts an OTLP/HTTP JSON traces payload and queues Pulse SDK spans.
 *
 * Responds per the OTLP spec: 200 with an empty ExportTraceServiceResponse on
 * full success, 200 with partialSuccess when some spans were dropped, and 400
 * only when the request itself is malformed.
 */
export async function handleOtlpTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  let extracted;
  try {
    extracted = extractOtlpSpans(body);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Invalid OTLP payload" },
      400,
    );
  }

  const { spans, rejectedSpans, errorMessage } = extracted;
  if (spans.length > 0) {
    try {
      await getSpanEventBus().publish(buildSpanIngestSubject(projectId), {
        projectId,
        spans,
      });
    } catch (err) {
      console.error(
        `[traces] POST /v1/traces - Failed to publish - project=${projectId}, count=${spans.length}`,
        err,
      );
      return c.json({ error: "Failed to enqueue span" }, 503);
    }
  }

  console.log(
    `[traces] POST /v1/traces - SUCCESS - project=${projectId}, queued=${spans.length}, rejected=${rejectedSpans}`,
  );
  if (rejectedSpans > 0) {
    return c.json(
      {
        partialSuccess: {
          rejectedSpans,
          errorMessage: errorMessage ?? "Spans failed validation",
        },
      },
      200,
    );
  }
  return c.json({}, 200);
}

/**
 * Handler for GET /v1/traces
 * Query traces for the authenticated project with optional filters.
 */
export async function getTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const rawQuery = c.req.query();

  console.log(
    `[traces] GET /v1/traces - project=${projectId}, query=${JSON.stringify(rawQuery)}`,
  );

  let params;
  try {
    params = traceQuerySchema.parse(rawQuery);
  } catch (err) {
    if (err instanceof ZodError) {
      console.error(
        `[traces] GET /v1/traces - Invalid query params - project=${projectId}, errors=${JSON.stringify(err.issues)}`,
      );
      return c.json(
        { error: "Invalid query parameters", details: err.issues },
        400,
      );
    }
    throw err;
  }

  const parseDateParam = (
    value: string | number | undefined,
    boundary: "start" | "end",
  ): Date | undefined => {
    if (value === undefined) return undefined;

    if (typeof value === "number") {
      const ms = value < 1_000_000_000_000 ? value * 1000 : value;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const trimmed = value.trim();
    if (!trimmed) return undefined;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const iso =
        boundary === "start"
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
    source: params.source,
    provider: params.provider,
    model: params.model,
    status: params.status,
    dateFrom,
    dateTo,
    limit: params.limit,
    offset: params.offset,
  };

  const page = await queryTraceSummaries(projectId, storage, filters);
  console.log(
    `[traces] GET /v1/traces - SUCCESS - project=${projectId}, returned=${page.traces.length}, total=${page.total}`,
  );
  return c.json(
    {
      traces: page.traces,
      total: page.total,
      limit: params.limit,
      offset: params.offset,
    },
    200,
  );
}

/**
 * Handler for GET /v1/traces/:id
 * Get a single trace by ID for the authenticated project.
 */
export async function getTraceById(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const traceId = c.req.param("id");
  if (!traceId) {
    return c.json({ error: "Trace id is required" }, 400);
  }

  console.log(
    `[traces] GET /v1/traces/:id - project=${projectId}, trace_id=${traceId}`,
  );

  const trace = await getTraceSummary(traceId, projectId, storage);

  if (!trace) {
    console.warn(
      `[traces] GET /v1/traces/:id - NOT FOUND - project=${projectId}, trace_id=${traceId}`,
    );
    return c.json({ error: "Trace not found" }, 404);
  }

  console.log(
    `[traces] GET /v1/traces/:id - SUCCESS - project=${projectId}, trace_id=${traceId}, status=${trace.status}, provider=${trace.provider}`,
  );
  return c.json(trace, 200);
}
