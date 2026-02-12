import type { TraceInput } from "../shared/validation";

export const TRACE_INGEST_SUBJECT = "pulse.traces.ingest";
export const TRACE_INGEST_WILDCARD = `${TRACE_INGEST_SUBJECT}.>`;

export const buildTraceIngestSubject = (projectId: string): string =>
  `${TRACE_INGEST_SUBJECT}.${projectId}`;

export interface TraceIngestEventPayload {
  projectId: string;
  traces: TraceInput[];
}
