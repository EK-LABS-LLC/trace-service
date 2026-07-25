import { WALWriter, WALIndex } from "./wal";
import { WALCheckpoint } from "./checkpoint";
import type { SpanIngestEventPayload } from "./subjects";
import { env } from "../config";

interface WALStartOptions {
  walDir: string;
  partitions: number;
}

let spanWalWriters: WALWriter[] = [];
let spanWalIndexes: WALIndex[] = [];
let spanWalCheckpoints: WALCheckpoint[] = [];
let spanWalDirs: string[] = [];

function resolvePartitionDirs(baseDir: string, partitions: number): string[] {
  if (partitions <= 1) {
    return [baseDir];
  }

  return Array.from({ length: partitions }, (_, index) => {
    return `${baseDir}/p${String(index + 1).padStart(2, "0")}`;
  });
}

function hashPartition(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getPartitionIndex(subject: string, partitions: number): number {
  if (partitions <= 1) {
    return 0;
  }
  return hashPartition(subject) % partitions;
}

function spanOptions(options?: Partial<WALStartOptions>): WALStartOptions {
  return {
    walDir: options?.walDir ?? env.WAL_SPAN_DIR,
    partitions: options?.partitions ?? env.SPAN_WAL_PARTITIONS,
  };
}

export function resolveSpanWALDirs(
  options?: Partial<WALStartOptions>,
): string[] {
  const config = spanOptions(options);
  return resolvePartitionDirs(config.walDir, config.partitions);
}

export function getSpanEventBus(): {
  publish: (subject: string, payload: SpanIngestEventPayload) => Promise<void>;
} {
  if (spanWalWriters.length === 0) {
    throw new Error("Span WAL not initialized. Call startSpanWAL() first.");
  }

  return {
    publish: async (subject: string, payload: SpanIngestEventPayload) => {
      const partition = getPartitionIndex(subject, spanWalWriters.length);
      const writer = spanWalWriters[partition];
      if (!writer) {
        throw new Error(`Span WAL writer missing for partition ${partition}`);
      }
      await writer.append(payload);
    },
  };
}

export async function startSpanWAL(
  options?: Partial<WALStartOptions>,
): Promise<void> {
  const config = spanOptions(options);
  spanWalDirs = resolveSpanWALDirs(options);
  spanWalWriters = [];
  spanWalIndexes = [];
  spanWalCheckpoints = [];

  for (const walDir of spanWalDirs) {
    const index = new WALIndex(walDir);
    const checkpoint = new WALCheckpoint(walDir);
    await checkpoint.load();

    const writer = new WALWriter(
      {
        walDir,
        maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
        maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
        maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
        fsyncEvery: env.WAL_FSYNC_EVERY,
        maxSegments: env.WAL_MAX_SEGMENTS,
        maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
      },
      index,
    );

    await writer.initialize();
    spanWalIndexes.push(index);
    spanWalCheckpoints.push(checkpoint);
    spanWalWriters.push(writer);
  }
}

export async function stopSpanWAL(): Promise<void> {
  for (const writer of spanWalWriters) {
    await writer.close();
  }
  spanWalWriters = [];
  spanWalIndexes = [];
  spanWalCheckpoints = [];
  spanWalDirs = [];
}

export function getSpanWALIndex(): WALIndex | null {
  return spanWalIndexes[0] ?? null;
}

export function getSpanWALCheckpoint(): WALCheckpoint | null {
  return spanWalCheckpoints[0] ?? null;
}

export function getSpanWALDirs(): string[] {
  return spanWalDirs;
}
