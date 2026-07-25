import type { Context } from "hono";
import { storage } from "../db";
import { getSessionSpans } from "../services/sessions";
import { listSessionTraceSummaries } from "../services/derived-traces";

/**
 * Handler for GET /v1/sessions/:id
 * Returns all span-derived traces for a session, ordered by timestamp ascending.
 */
export async function handleGetSessionTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const sessionId = c.req.param("id");
  if (!sessionId) {
    return c.json({ error: "Session id is required" }, 400);
  }

  const traces = await listSessionTraceSummaries(sessionId, projectId, storage);

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
