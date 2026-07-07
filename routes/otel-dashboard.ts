import type { Context } from "hono";
import { storage } from "../db";
import type { TraceSummaryQueryFilters } from "../db/adapter";

function parseDateParam(
  value: string | number | undefined,
  boundary: "start" | "end",
): Date | undefined {
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
      boundary === "start" ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.999Z`;
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
}

function parseSummaryFilters(c: Context): TraceSummaryQueryFilters | Response {
  const query = c.req.query();
  const dateFrom = parseDateParam(query.date_from, "start");
  const dateTo = parseDateParam(query.date_to, "end");
  if (query.date_from !== undefined && !dateFrom) {
    return c.json({ error: "Invalid date_from parameter" }, 400);
  }
  if (query.date_to !== undefined && !dateTo) {
    return c.json({ error: "Invalid date_to parameter" }, 400);
  }

  const sort =
    query.sort === "oldest" ||
    query.sort === "duration" ||
    query.sort === "errors" ||
    query.sort === "volume"
      ? query.sort
      : "recent";

  return {
    dateFrom,
    dateTo,
    source: query.source,
    status: query.status === "success" || query.status === "error" ? query.status : undefined,
    limit: query.limit ? Math.min(Math.max(Number(query.limit), 1), 1000) : 100,
    offset: query.offset ? Math.max(Number(query.offset), 0) : 0,
    sort,
  };
}

function isResponse(value: TraceSummaryQueryFilters | Response): value is Response {
  return value instanceof Response;
}

export async function getDashboardSessions(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const filters = parseSummaryFilters(c);
  if (isResponse(filters)) return filters;

  const result = await storage.querySessionSummaries(projectId, filters);
  return c.json(
    {
      sessions: result.sessions,
      total: result.total,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    },
    200,
  );
}

export async function getDashboardSessionTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const sessionId = c.req.param("id");
  const filters = parseSummaryFilters(c);
  if (isResponse(filters)) return filters;

  const result = await storage.queryTraceSummaries(projectId, {
    ...filters,
    sessionId,
  });
  if (result.traces.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json(
    {
      sessionId,
      traces: result.traces,
      total: result.total,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    },
    200,
  );
}

export async function getDashboardTrace(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const traceId = c.req.param("traceId") || c.req.param("id");
  const trace = await storage.getTraceSummary(traceId, projectId);
  if (!trace) {
    return c.json({ error: "Trace not found" }, 404);
  }
  return c.json(trace, 200);
}

export async function getDashboardTraceSpans(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const traceId = c.req.param("traceId") || c.req.param("id");
  const spans = await storage.getTraceSpans(traceId, projectId);
  if (spans.length === 0) {
    return c.json({ error: "Trace not found" }, 404);
  }
  return c.json({ traceId, spans, total: spans.length }, 200);
}
