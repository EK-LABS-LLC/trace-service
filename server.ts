import { env } from "./config";
import { closeDb } from "./db";
import { createApp } from "./app";
import { getRuntimeServices } from "./runtime/services";
import {
  startSpanWAL,
  stopSpanWAL,
  resolveSpanWALDirs,
} from "./event-bus/client";
import { SpanStreamListener } from "./event-bus/span-listener";
import { WALCheckpoint } from "./event-bus/checkpoint";

type RuntimeModeFlags = {
  runApi: boolean;
  runListeners: boolean;
};

type RuntimeApiState = {
  server: ReturnType<typeof Bun.serve> | null;
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

async function startApiRuntime(
  flags: RuntimeModeFlags,
): Promise<RuntimeApiState> {
  if (!flags.runApi) {
    return {
      server: null,
      spanWalStarted: false,
    };
  }

  const app = createApp();
  const server = Bun.serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  await startSpanWAL({
    walDir: env.WAL_SPAN_DIR,
    partitions: env.SPAN_WAL_PARTITIONS,
  });

  return {
    server,
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
  spanPartitions: number,
): void {
  const portInfo = flags.runApi ? `, port=${env.PORT}` : "";
  console.log(
    `Pulse runtime started (mode=${env.PULSE_MODE}, runtime=${env.PULSE_RUNTIME_MODE}, api=${flags.runApi ? "on" : "off"}, listeners=${flags.runListeners ? "on" : "off"}, span_partitions=${spanPartitions}${portInfo})`,
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
  const runtime = getRuntimeServices();
  await runtime.bootstrapDb();

  const flags = getRuntimeFlags();
  const { server, spanWalStarted } = await startApiRuntime(flags);
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

  logRuntimeStarted(flags, spanListeners.length);

  const shutdown = async () => {
    console.log("Starting graceful shutdown...");

    const shutdownTimeout = setTimeout(() => {
      console.error("Shutdown timeout exceeded, forcing exit");
      process.exit(1);
    }, 30000);

    try {
      server?.stop();
      spanListeners.forEach((listener) => listener.stop());
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
