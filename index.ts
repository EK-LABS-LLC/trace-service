import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config";
import { closeDb } from "./db";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errors";
import { logger } from "./middleware/logger";
import { auth } from "./auth/auth";
import {
  handleBatchTraces,
  handleAsyncTrace,
  getTraces,
  getTraceById,
} from "./routes/traces";
import {
  handleBatchSpans,
  handleAsyncSpan,
  getSpans,
  getSpanById,
} from "./routes/spans";
import { handleGetSessionTraces } from "./routes/sessions";
import { handleGetAnalytics } from "./routes/analytics";
import { isAuthenticated } from "./routes/auth";
import { handleSignupWithProject } from "./routes/signup";
import { dashboard } from "./routes/dashboard";
import { stripeRoutes } from "./routes/stripe";
import {
  startWAL,
  stopWAL,
  startSpanWAL,
  stopSpanWAL,
} from "./event-bus/client";
import { TraceStreamListener } from "./event-bus/listener";
import { SpanStreamListener } from "./event-bus/span-listener";
import { WALCheckpoint } from "./event-bus/checkpoint";

const app = new Hono();

app.onError(errorHandler);
app.use("*", logger);

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "pulse" });
});

app.use(
  "/api/auth/*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use(
  "/dashboard/api/*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization", "X-Project-Id"],
    allowMethods: ["POST", "GET", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(
  "/dashboard/api/stripe/*",
  cors({
    origin: env.FRONTEND_URL,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Better-Auth exposes this route by default
app.post("/api/auth/sign-up/email", (c) => {
  return c.json(
    { error: "Use /dashboard/api/signup for account creation" },
    403,
  );
});

app.post("/dashboard/api/signup", handleSignupWithProject);
app.route("/dashboard/api", dashboard);
app.route("/dashboard/api/stripe", stripeRoutes);

app.post("/v1/auth/login", isAuthenticated);

app.post("/v1/traces/batch", authMiddleware, handleBatchTraces);
app.post("/v1/traces/async", authMiddleware, handleAsyncTrace);
app.get("/v1/traces", authMiddleware, getTraces);
app.get("/v1/traces/:id", authMiddleware, getTraceById);
app.post("/v1/spans/batch", authMiddleware, handleBatchSpans);
app.post("/v1/spans/async", authMiddleware, handleAsyncSpan);
app.get("/v1/spans", authMiddleware, getSpans);
app.get("/v1/spans/:id", authMiddleware, getSpanById);
app.get("/v1/sessions/:id", authMiddleware, handleGetSessionTraces);
app.get("/v1/analytics", authMiddleware, handleGetAnalytics);

const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
});

await startWAL();
await startSpanWAL();

const walCheckpoint = new WALCheckpoint(env.WAL_DIR);
await walCheckpoint.load();

const traceListener = new TraceStreamListener(
  {
    walDir: env.WAL_DIR,
    maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
    maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
    maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
    fsyncEvery: env.WAL_FSYNC_EVERY,
    maxSegments: env.WAL_MAX_SEGMENTS,
    maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
  },
  walCheckpoint,
  env.WAL_MAX_RETRIES,
);
void traceListener.start();

const spanCheckpoint = new WALCheckpoint(env.WAL_SPAN_DIR);
await spanCheckpoint.load();

const spanListener = new SpanStreamListener(
  {
    walDir: env.WAL_SPAN_DIR,
    maxSegmentSize: env.WAL_MAX_SEGMENT_SIZE,
    maxSegmentAge: env.WAL_MAX_SEGMENT_AGE,
    maxSegmentLines: env.WAL_MAX_SEGMENT_LINES,
    fsyncEvery: env.WAL_FSYNC_EVERY,
    maxSegments: env.WAL_MAX_SEGMENTS,
    maxRetentionAge: env.WAL_MAX_RETENTION_AGE,
  },
  spanCheckpoint,
  env.WAL_MAX_RETRIES,
);
void spanListener.start();

console.log(`Pulse server running on port ${env.PORT}`);

const shutdown = async () => {
  console.log("Starting graceful shutdown...");

  const shutdownTimeout = setTimeout(() => {
    console.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000);

  try {
    server.stop();
    traceListener.stop();
    spanListener.stop();
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

export { app };
