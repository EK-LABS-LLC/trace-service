import type { StorageAdapter } from "../db/adapter";
import type { Span } from "../db/schema";

export interface SessionSpansResult {
  sessionId: string;
  spans: Span[];
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
