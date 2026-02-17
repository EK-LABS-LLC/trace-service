import type { Context } from "hono";
import { storage } from "../db";
import { ingestSpans, querySpans, getSpan } from "../services/spans";
import { ZodError } from "zod";
import { spanQuerySchema, batchSpanSchema } from "../shared/validation";
import type { SpanInput } from "../shared/validation";
import { getSpanEventBus } from "../event-bus/client";
import { buildSpanIngestSubject } from "../event-bus/subjects";

export async function handleBatchSpans(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const result = await ingestSpans(projectId, body, storage);
    return c.json(result, 202);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", details: err.issues }, 400);
    }
    throw err;
  }
}

export async function handleAsyncSpan(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  let spans: SpanInput[];
  try {
    spans = batchSpanSchema.parse(payload);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", details: err.issues }, 400);
    }
    throw err;
  }

  try {
    await getSpanEventBus().publish(buildSpanIngestSubject(projectId), {
      projectId,
      spans,
    });
    return c.json({ status: "queued", count: spans.length }, 202);
  } catch {
    return c.json({ error: "Failed to enqueue span" }, 503);
  }
}

export async function getSpans(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const rawQuery = c.req.query();

  let params;
  try {
    params = spanQuerySchema.parse(rawQuery);
  } catch (err) {
    if (err instanceof ZodError) {
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

    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1_000_000_000_000 ? num * 1000 : num;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

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
    kind: params.kind,
    toolName: params.tool_name,
    status: params.status,
    dateFrom,
    dateTo,
    limit: params.limit,
    offset: params.offset,
  };

  const result = await querySpans(projectId, filters, storage);
  return c.json(result, 200);
}

export async function getSpanById(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const spanId = c.req.param("id");

  const span = await getSpan(spanId, projectId, storage);

  if (!span) {
    return c.json({ error: "Span not found" }, 404);
  }

  return c.json(span, 200);
}
