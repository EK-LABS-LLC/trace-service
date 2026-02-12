import { Hono } from "hono";
import { sessionMiddleware } from "../middleware/session";
import {
  projectContextMiddleware,
  requireProjectAdmin,
} from "../middleware/project-context";
import { handleGetApiKeys, handleDeleteApiKey } from "./admin";
import { handleGetProjects, handleCreateProjectForCurrentUser } from "./dashboard-projects";
import { handleGetProjectUsers, handleCreateProjectUser } from "./dashboard-users";
import { handleBatchTraces, getTraces, getTraceById } from "./traces";
import { handleGetSessionTraces } from "./sessions";
import { handleGetAnalytics } from "./analytics";

const dashboard = new Hono();

dashboard.use("*", sessionMiddleware);

dashboard.get("/projects", handleGetProjects);
dashboard.post("/projects", handleCreateProjectForCurrentUser);
dashboard.get("/api-keys", projectContextMiddleware, requireProjectAdmin, handleGetApiKeys);
dashboard.delete("/api-keys/:id", projectContextMiddleware, requireProjectAdmin, handleDeleteApiKey);
dashboard.get("/users", projectContextMiddleware, requireProjectAdmin, handleGetProjectUsers);
dashboard.post("/users", projectContextMiddleware, requireProjectAdmin, handleCreateProjectUser);
dashboard.post("/traces/batch", projectContextMiddleware, handleBatchTraces);
dashboard.get("/traces", projectContextMiddleware, getTraces);
dashboard.get("/traces/:id", projectContextMiddleware, getTraceById);
dashboard.get("/sessions/:id", projectContextMiddleware, handleGetSessionTraces);
dashboard.get("/analytics", projectContextMiddleware, handleGetAnalytics);

export { dashboard };
