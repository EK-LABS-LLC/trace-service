import { env } from "./config";
import { closeDb } from "./db";
import { createApp } from "./app";
import {
  startWAL,
  stopWAL,
  startSpanWAL,
  stopSpanWAL,
  getWALDirs,
  getSpanWALDirs,
} from "./event-bus/client";
import { TraceStreamListener } from "./event-bus/listener";
import { SpanStreamListener } from "./event-bus/span-listener";
import { WALCheckpoint } from "./event-bus/checkpoint";

export async function startPulseServer(): Promise<void> {
  const app = createApp();

  const server = Bun.serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  await startWAL({
    walDir: env.WAL_DIR,
    partitions: env.TRACE_WAL_PARTITIONS,
  });
  await startSpanWAL({
    walDir: env.WAL_SPAN_DIR,
    partitions: env.SPAN_WAL_PARTITIONS,
  });

  const traceListeners: TraceStreamListener[] = [];
  for (const walDir of getWALDirs()) {
    const checkpoint = new WALCheckpoint(walDir);
    await checkpoint.load();

    const listener = new TraceStreamListener(
      {
        walDir,
        maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
        maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
        maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
        fsyncEvery: env.WAL_FSYNC_EVERY,
        maxSegments: env.WAL_MAX_SEGMENTS,
        maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
      },
      checkpoint,
      env.WAL_MAX_RETRIES,
    );
    traceListeners.push(listener);
    void listener.start();
  }

  const spanListeners: SpanStreamListener[] = [];
  for (const walDir of getSpanWALDirs()) {
    const checkpoint = new WALCheckpoint(walDir);
    await checkpoint.load();

    const listener = new SpanStreamListener(
      {
        walDir,
        maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
        maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
        maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
        fsyncEvery: env.WAL_FSYNC_EVERY,
        maxSegments: env.WAL_MAX_SEGMENTS,
        maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
      },
      checkpoint,
      env.WAL_MAX_RETRIES,
    );
    spanListeners.push(listener);
    void listener.start();
  }

  console.log(
    `Pulse server running on port ${env.PORT} (mode=${env.PULSE_MODE}, trace_partitions=${traceListeners.length}, span_partitions=${spanListeners.length})`,
  );

  const shutdown = async () => {
    console.log("Starting graceful shutdown...");

    const shutdownTimeout = setTimeout(() => {
      console.error("Shutdown timeout exceeded, forcing exit");
      process.exit(1);
    }, 30000);

    try {
      server.stop();
      traceListeners.forEach((listener) => listener.stop());
      spanListeners.forEach((listener) => listener.stop());
      await stopWAL();
      await stopSpanWAL();
      await closeDb();
      clearTimeout(shutdownTimeout);
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
