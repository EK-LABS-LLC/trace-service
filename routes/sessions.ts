import type { Context } from "hono";
import { storage } from "../db";
import { getSessionTraces, getSessionSpans } from "../services/sessions";
import { listSdkSessionTraceSummaries } from "../services/sdk-traces";

function timestampMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

/**
 * Handler for GET /v1/sessions/:id
 * Returns all traces for a session (legacy + SDK-derived), ordered by timestamp.
 */
export async function handleGetSessionTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const sessionId = c.req.param("id");
  if (!sessionId) {
    return c.json({ error: "Session id is required" }, 400);
  }

  const result = await getSessionTraces(sessionId, projectId, storage);
  const sdkTraces = await listSdkSessionTraceSummaries(sessionId, projectId, storage);

  const traces = [...result.traces, ...sdkTraces].sort(
    (a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp),
  );

  // Return 404 if session has no traces (doesn't exist or belongs to another project)
  if (traces.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ sessionId, traces }, 200);
}

/**
 * Handler for GET /v1/sessions/:id/spans
 * Returns all spans for a session.
 */
export async function handleGetSessionSpans(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const sessionId = c.req.param("id");
  if (!sessionId) {
    return c.json({ error: "Session id is required" }, 400);
  }

  const result = await getSessionSpans(sessionId, projectId, storage);

  if (result.spans.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json(result, 200);
}
