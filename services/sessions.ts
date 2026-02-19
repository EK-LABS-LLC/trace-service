import type { StorageAdapter } from "../db/adapter";
import type { Trace, Span } from "../db/schema";

/**
 * Result of a session traces query.
 */
export interface SessionTracesResult {
  sessionId: string;
  traces: Trace[];
}

export interface SessionSpansResult {
  sessionId: string;
  spans: Span[];
}

/**
 * Get all traces for a session, ordered by timestamp ascending.
 * Returns the session ID and its traces.
 */
export async function getSessionTraces(
  sessionId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<SessionTracesResult> {
  const traces = await storage.getSessionTraces(sessionId, projectId);

  return {
    sessionId,
    traces,
  };
}

export async function getSessionSpans(
  sessionId: string,
  projectId: string,
  storage: StorageAdapter,
): Promise<SessionSpansResult> {
  const spans = await storage.getSessionSpans(sessionId, projectId);

  return {
    sessionId,
    spans,
  };
}
