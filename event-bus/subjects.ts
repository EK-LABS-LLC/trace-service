import type { TraceInput, SpanInput } from "../shared/validation";

export const TRACE_INGEST_SUBJECT = "pulse.traces.ingest";
export const TRACE_INGEST_WILDCARD = `${TRACE_INGEST_SUBJECT}.>`;

export const buildTraceIngestSubject = (projectId: string): string =>
  `${TRACE_INGEST_SUBJECT}.${projectId}`;

export interface TraceIngestEventPayload {
  projectId: string;
  traces: TraceInput[];
}

export const SPAN_INGEST_SUBJECT = "pulse.spans.ingest";
export const SPAN_INGEST_WILDCARD = `${SPAN_INGEST_SUBJECT}.>`;

export const buildSpanIngestSubject = (projectId: string): string =>
  `${SPAN_INGEST_SUBJECT}.${projectId}`;

export interface SpanIngestEventPayload {
  projectId: string;
  spans: SpanInput[];
}
