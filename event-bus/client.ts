import { WALWriter, WALIndex } from "./wal";
import { WALCheckpoint } from "./checkpoint";
import type { SpanIngestEventPayload, TraceIngestEventPayload } from "./subjects";
import { env } from "../config";

let traceWalWriter: WALWriter | null = null;
let traceWalIndex: WALIndex | null = null;
let traceWalCheckpoint: WALCheckpoint | null = null;

let spanWalWriter: WALWriter | null = null;
let spanWalIndex: WALIndex | null = null;
let spanWalCheckpoint: WALCheckpoint | null = null;

export function getEventBus(): {
  publish: (subject: string, payload: TraceIngestEventPayload) => Promise<void>;
} {
  if (!traceWalWriter) {
    throw new Error("WAL not initialized. Call startWAL() first.");
  }
  return {
    publish: async (_subject: string, payload: TraceIngestEventPayload) => {
      await traceWalWriter!.append(payload);
    },
  };
}

export async function startWAL(): Promise<void> {
  traceWalIndex = new WALIndex(env.WAL_DIR);

  traceWalCheckpoint = new WALCheckpoint(env.WAL_DIR);
  await traceWalCheckpoint.load();

  traceWalWriter = new WALWriter(
    {
      walDir: env.WAL_DIR,
      maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
      maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
      maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
      fsyncEvery: env.WAL_FSYNC_EVERY,
      maxSegments: env.WAL_MAX_SEGMENTS,
      maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
    },
    traceWalIndex,
  );

  await traceWalWriter.initialize();
}

export async function stopWAL(): Promise<void> {
  if (traceWalWriter) {
    await traceWalWriter.close();
    traceWalWriter = null;
  }
}

export function getSpanEventBus(): {
  publish: (subject: string, payload: SpanIngestEventPayload) => Promise<void>;
} {
  if (!spanWalWriter) {
    throw new Error("Span WAL not initialized. Call startSpanWAL() first.");
  }
  return {
    publish: async (_subject: string, payload: SpanIngestEventPayload) => {
      await spanWalWriter!.append(payload);
    },
  };
}

export async function startSpanWAL(): Promise<void> {
  spanWalIndex = new WALIndex(env.WAL_SPAN_DIR);
  spanWalCheckpoint = new WALCheckpoint(env.WAL_SPAN_DIR);
  await spanWalCheckpoint.load();

  spanWalWriter = new WALWriter(
    {
      walDir: env.WAL_SPAN_DIR,
      maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
      maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
      maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
      fsyncEvery: env.WAL_FSYNC_EVERY,
      maxSegments: env.WAL_MAX_SEGMENTS,
      maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
    },
    spanWalIndex,
  );

  await spanWalWriter.initialize();
}

export async function stopSpanWAL(): Promise<void> {
  if (spanWalWriter) {
    await spanWalWriter.close();
    spanWalWriter = null;
  }
}

export function getWALIndex(): WALIndex | null {
  return traceWalIndex;
}

export function getWALCheckpoint(): WALCheckpoint | null {
  return traceWalCheckpoint;
}

export function getSpanWALIndex(): WALIndex | null {
  return spanWalIndex;
}

export function getSpanWALCheckpoint(): WALCheckpoint | null {
  return spanWalCheckpoint;
}
