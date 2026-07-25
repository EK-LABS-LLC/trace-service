import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config";
import { serveDashboard } from "./dashboard-static";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errors";
import { logger } from "./middleware/logger";
import { auth } from "./auth/auth";
import { handleOtlpTraces, getTraces, getTraceById } from "./routes/traces";
import {
  handleBatchSpans,
  handleAsyncSpan,
  getSpans,
  getSpanById,
} from "./routes/spans";
import {
  handleGetSessionTraces,
  handleGetSessionSpans,
} from "./routes/sessions";
import { handleGetAnalytics, handleGetSpanAnalytics } from "./routes/analytics";
import { isAuthenticated } from "./routes/auth";
import { handleSignupWithProject } from "./routes/signup";
import { dashboard } from "./routes/dashboard";
import {
  handleConsumeLocalLoginToken,
  handleCreateLocalLoginToken,
} from "./routes/local-login";

export function allowedOrigins(): string[] {
  return (env.PULSE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Exact-match origin check for credentialed CORS. The dashboard is served
 * same-origin, so no allowlist entries are needed for normal deployments;
 * wildcard entries are ignored because these routes allow credentials.
 */
function corsOrigin(allowed: string[]): (origin: string) => string | null {
  return (origin) => {
    return allowed.includes(origin) ? origin : null;
  };
}

export function createApp(): Hono {
  const app = new Hono();
  const allowed = allowedOrigins();
  if (allowed.includes("*")) {
    console.warn(
      "[cors] Ignoring wildcard PULSE_ALLOWED_ORIGINS for credentialed dashboard routes; configure explicit origins",
    );
  }
  const origins = corsOrigin(allowed.filter((origin) => origin !== "*"));

  app.onError(errorHandler);
  app.use("*", logger);

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "pulse" });
  });

  app.use(
    "/api/auth/*",
    cors({
      origin: origins,
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
      origin: origins,
      allowHeaders: ["Content-Type", "Authorization", "X-Project-Id"],
      allowMethods: ["POST", "GET", "DELETE", "OPTIONS"],
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
  app.post("/dashboard/api/local-login-token", handleCreateLocalLoginToken);
  app.get("/dashboard/api/local-login", handleConsumeLocalLoginToken);
  app.route("/dashboard/api", dashboard);

  app.post("/v1/auth/login", isAuthenticated);

  app.post("/v1/traces", authMiddleware, handleOtlpTraces);
  app.get("/v1/traces", authMiddleware, getTraces);
  app.get("/v1/traces/:id", authMiddleware, getTraceById);
  app.post("/v1/spans/batch", authMiddleware, handleBatchSpans);
  app.post("/v1/spans/async", authMiddleware, handleAsyncSpan);
  app.get("/v1/spans", authMiddleware, getSpans);
  app.get("/v1/spans/:id", authMiddleware, getSpanById);
  app.get("/v1/sessions/:id", authMiddleware, handleGetSessionTraces);
  app.get("/v1/sessions/:id/spans", authMiddleware, handleGetSessionSpans);
  app.get("/v1/analytics", authMiddleware, handleGetAnalytics);
  app.get("/v1/analytics/spans", authMiddleware, handleGetSpanAnalytics);
  app.get("*", serveDashboard);

  return app;
}
