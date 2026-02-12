import type { Context, Next } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { userProjects } from "../db/schema";
import { normalizeProjectRole } from "../services/project-roles";

export async function projectContextMiddleware(c: Context, next: Next): Promise<Response | void> {
  const projectId = c.req.header("X-Project-Id");
  if (!projectId) {
    return c.json({ error: "Missing X-Project-Id header" }, 400);
  }

  const userId = c.get("userId") as string;

  const [access] = await db
    .select({ id: userProjects.id, role: userProjects.role })
    .from(userProjects)
    .where(and(eq(userProjects.userId, userId), eq(userProjects.projectId, projectId)))
    .limit(1);

  if (!access) {
    return c.json({ error: "Forbidden: no access to this project" }, 403);
  }

  c.set("projectId", projectId);
  c.set("projectRole", normalizeProjectRole(access.role));
  await next();
}

export async function requireProjectAdmin(c: Context, next: Next): Promise<Response | void> {
  const role = normalizeProjectRole(c.get("projectRole") as string | null | undefined);

  if (role !== "admin") {
    return c.json({ error: "Forbidden: admin role required for this operation" }, 403);
  }

  await next();
}
