import type { SpanIngestEventPayload, TraceIngestEventPayload } from "./subjects";

export type WALPayload = TraceIngestEventPayload | SpanIngestEventPayload;

export interface WALRecord {
  sequence: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  payload: WALPayload;
}

export function encodeRecord(record: WALRecord): string {
  return JSON.stringify(record) + "\n";
}

export function decodeRecord(line: string): WALRecord {
  return JSON.parse(line) as WALRecord;
}

export function isValidJSON(line: string): boolean {
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}
