import type { SpanInput } from "../shared/validation";

export const SPAN_INGEST_SUBJECT = "pulse.spans.ingest";
export const SPAN_INGEST_WILDCARD = `${SPAN_INGEST_SUBJECT}.>`;

export const buildSpanIngestSubject = (projectId: string): string =>
  `${SPAN_INGEST_SUBJECT}.${projectId}`;

export interface SpanIngestEventPayload {
  projectId: string;
  spans: SpanInput[];
}
