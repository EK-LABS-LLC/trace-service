import type { StorageAdapter } from "../db/adapter";
import type { Trace } from "../db/schema";

/**
 * Result of a session traces query.
 */
export interface SessionTracesResult {
  sessionId: string;
  traces: Trace[];
}

/**
 * Get all traces for a session, ordered by timestamp ascending.
 * Returns the session ID and its traces.
 */
export async function getSessionTraces(
  sessionId: string,
  projectId: string,
  storage: StorageAdapter
): Promise<SessionTracesResult> {
  const traces = await storage.getSessionTraces(sessionId, projectId);

  return {
    sessionId,
    traces,
  };
}
