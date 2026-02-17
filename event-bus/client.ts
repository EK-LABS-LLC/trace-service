import { WALWriter, WALIndex } from "./wal";
import { WALCheckpoint } from "./checkpoint";
import type { TraceIngestEventPayload } from "./subjects";
import { env } from "../config";

let walWriter: WALWriter | null = null;
let walIndex: WALIndex | null = null;
let walCheckpoint: WALCheckpoint | null = null;

export function getEventBus(): {
  publish: (subject: string, payload: unknown) => Promise<void>;
} {
  if (!walWriter) {
    throw new Error("WAL not initialized. Call startWAL() first.");
  }
  return {
    publish: async (_subject: string, payload: unknown) => {
      await walWriter!.append(payload as TraceIngestEventPayload);
    },
  };
}

export async function startWAL(): Promise<void> {
  // Create index
  walIndex = new WALIndex(env.WAL_DIR);

  // Create checkpoint
  walCheckpoint = new WALCheckpoint(env.WAL_DIR);
  await walCheckpoint.load();

  // Create writer
  walWriter = new WALWriter(
    {
      walDir: env.WAL_DIR,
      maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
      maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
      maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
      fsyncEvery: env.WAL_FSYNC_EVERY,
      maxSegments: env.WAL_MAX_SEGMENTS,
      maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
    },
    walIndex,
  );

  await walWriter.initialize();
}

export async function stopWAL(): Promise<void> {
  if (walWriter) {
    await walWriter.close();
    walWriter = null;
  }
}

// Export for listener access
export function getWALIndex(): WALIndex | null {
  return walIndex;
}

export function getWALCheckpoint(): WALCheckpoint | null {
  return walCheckpoint;
}
