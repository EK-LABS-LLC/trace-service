import { env } from "./config";
import { closeDb } from "./db";
import { createApp } from "./app";
import {
  startWAL,
  stopWAL,
  startSpanWAL,
  stopSpanWAL,
  resolveTraceWALDirs,
  resolveSpanWALDirs,
} from "./event-bus/client";
import { TraceStreamListener } from "./event-bus/listener";
import { SpanStreamListener } from "./event-bus/span-listener";
import { WALCheckpoint } from "./event-bus/checkpoint";

type RuntimeModeFlags = {
  runApi: boolean;
  runListeners: boolean;
};

type RuntimeApiState = {
  server: ReturnType<typeof Bun.serve> | null;
  traceWalStarted: boolean;
  spanWalStarted: boolean;
};

function getRuntimeFlags(): RuntimeModeFlags {
  return {
    runApi: env.PULSE_RUNTIME_MODE !== "listener",
    runListeners: env.PULSE_RUNTIME_MODE !== "api",
  };
}

function getWalListenerConfig(walDir: string) {
  return {
    walDir,
    maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
    maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
    maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
    fsyncEvery: env.WAL_FSYNC_EVERY,
    maxSegments: env.WAL_MAX_SEGMENTS,
    maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
  };
}

async function startApiRuntime(flags: RuntimeModeFlags): Promise<RuntimeApiState> {
  if (!flags.runApi) {
    return {
      server: null,
      traceWalStarted: false,
      spanWalStarted: false,
    };
  }

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

  return {
    server,
    traceWalStarted: true,
    spanWalStarted: true,
  };
}

async function startListeners<T extends { start: () => Promise<void> }>(
  enabled: boolean,
  walDirs: string[],
  createListener: (walDir: string, checkpoint: WALCheckpoint) => T,
): Promise<T[]> {
  if (!enabled) {
    return [];
  }

  const listeners: T[] = [];
  for (const walDir of walDirs) {
    const checkpoint = new WALCheckpoint(walDir);
    await checkpoint.load();

    const listener = createListener(walDir, checkpoint);
    listeners.push(listener);
    void listener.start();
  }

  return listeners;
}

function logRuntimeStarted(
  flags: RuntimeModeFlags,
  tracePartitions: number,
  spanPartitions: number,
): void {
  const portInfo = flags.runApi ? `, port=${env.PORT}` : "";
  console.log(
    `Pulse runtime started (mode=${env.PULSE_MODE}, runtime=${env.PULSE_RUNTIME_MODE}, api=${flags.runApi ? "on" : "off"}, listeners=${flags.runListeners ? "on" : "off"}, trace_partitions=${tracePartitions}, span_partitions=${spanPartitions}${portInfo})`,
  );
}

async function stopWalIfStarted(
  started: boolean,
  stopFn: () => Promise<void>,
): Promise<void> {
  if (started) {
    await stopFn();
  }
}

export async function startPulseServer(): Promise<void> {
  const flags = getRuntimeFlags();
  const { server, traceWalStarted, spanWalStarted } = await startApiRuntime(
    flags,
  );
  const traceListeners = await startListeners(
    flags.runListeners,
    resolveTraceWALDirs(),
    (walDir, checkpoint) =>
      new TraceStreamListener(
        getWalListenerConfig(walDir),
        checkpoint,
        env.WAL_MAX_RETRIES,
      ),
  );
  const spanListeners = await startListeners(
    flags.runListeners,
    resolveSpanWALDirs(),
    (walDir, checkpoint) =>
      new SpanStreamListener(
        getWalListenerConfig(walDir),
        checkpoint,
        env.WAL_MAX_RETRIES,
      ),
  );

  logRuntimeStarted(flags, traceListeners.length, spanListeners.length);

  const shutdown = async () => {
    console.log("Starting graceful shutdown...");

    const shutdownTimeout = setTimeout(() => {
      console.error("Shutdown timeout exceeded, forcing exit");
      process.exit(1);
    }, 30000);

    try {
      server?.stop();
      traceListeners.forEach((listener) => listener.stop());
      spanListeners.forEach((listener) => listener.stop());
      await stopWalIfStarted(traceWalStarted, stopWAL);
      await stopWalIfStarted(spanWalStarted, stopSpanWAL);
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
