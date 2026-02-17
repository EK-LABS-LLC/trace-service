import type { TraceIngestEventPayload } from "./subjects";

export interface WALRecord {
  sequence: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  payload: TraceIngestEventPayload;
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
