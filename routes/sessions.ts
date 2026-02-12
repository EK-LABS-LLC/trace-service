import type { Context } from "hono";
import { storage } from "../db/postgres";
import { getSessionTraces } from "../services/sessions";

/**
 * Handler for GET /v1/sessions/:id
 * Get all traces for a session, ordered by timestamp ascending.
 */
export async function handleGetSessionTraces(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const sessionId = c.req.param("id");

  const result = await getSessionTraces(sessionId, projectId, storage);

  // Return 404 if session has no traces (doesn't exist or belongs to another project)
  if (result.traces.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json(result, 200);
}
