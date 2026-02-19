import { Hono } from "hono";
import { sessionMiddleware } from "../middleware/session";
import {
  projectContextMiddleware,
  requireProjectAdmin,
} from "../middleware/project-context";
import {
  handleGetApiKeys,
  handleDeleteApiKey,
  handleCreateApiKey,
  handleUpdateApiKey,
} from "./admin";
import {
  handleGetProjects,
  handleCreateProjectForCurrentUser,
} from "./dashboard-projects";
import {
  handleGetProjectUsers,
  handleCreateProjectUser,
} from "./dashboard-users";
import { handleBatchTraces, getTraces, getTraceById } from "./traces";
import { handleGetSessionTraces, handleGetSessionSpans } from "./sessions";
import { handleGetAnalytics, handleGetSpanAnalytics } from "./analytics";
import {
  handleBatchSpans,
  handleAsyncSpan,
  getSpans,
  getSpanById,
} from "./spans";

const dashboard = new Hono();

dashboard.use("*", sessionMiddleware);

dashboard.get("/projects", handleGetProjects);
dashboard.post("/projects", handleCreateProjectForCurrentUser);
dashboard.get(
  "/api-keys",
  projectContextMiddleware,
  requireProjectAdmin,
  handleGetApiKeys,
);
dashboard.post(
  "/api-keys",
  projectContextMiddleware,
  requireProjectAdmin,
  handleCreateApiKey,
);
dashboard.patch(
  "/api-keys/:id",
  projectContextMiddleware,
  requireProjectAdmin,
  handleUpdateApiKey,
);
dashboard.delete(
  "/api-keys/:id",
  projectContextMiddleware,
  requireProjectAdmin,
  handleDeleteApiKey,
);
dashboard.get(
  "/users",
  projectContextMiddleware,
  requireProjectAdmin,
  handleGetProjectUsers,
);
dashboard.post(
  "/users",
  projectContextMiddleware,
  requireProjectAdmin,
  handleCreateProjectUser,
);
dashboard.post("/traces/batch", projectContextMiddleware, handleBatchTraces);
dashboard.get("/traces", projectContextMiddleware, getTraces);
dashboard.get("/traces/:id", projectContextMiddleware, getTraceById);
dashboard.get(
  "/sessions/:id",
  projectContextMiddleware,
  handleGetSessionTraces,
);
dashboard.get(
  "/sessions/:id/spans",
  projectContextMiddleware,
  handleGetSessionSpans,
);
dashboard.get("/analytics", projectContextMiddleware, handleGetAnalytics);
dashboard.get(
  "/analytics/spans",
  projectContextMiddleware,
  handleGetSpanAnalytics,
);
dashboard.post("/spans/batch", projectContextMiddleware, handleBatchSpans);
dashboard.post("/spans/async", projectContextMiddleware, handleAsyncSpan);
dashboard.get("/spans", projectContextMiddleware, getSpans);
dashboard.get("/spans/:id", projectContextMiddleware, getSpanById);

export { dashboard };
