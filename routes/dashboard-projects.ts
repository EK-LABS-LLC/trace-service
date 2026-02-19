import type { Context } from "hono";
import { db } from "../db";
import { createProjectForUser, getUserProjects } from "../services/admin";

export async function handleGetProjects(c: Context): Promise<Response> {
  const userId = c.get("userId") as string;
  const projects = await getUserProjects(userId, db);
  return c.json({ projects });
}

export async function handleCreateProjectForCurrentUser(
  c: Context,
): Promise<Response> {
  const body = await c.req.json<{ name?: string }>();

  if (!body.name || typeof body.name !== "string") {
    return c.json({ error: "Missing required field: name" }, 400);
  }

  const name = body.name.trim();
  if (name.length === 0) {
    return c.json({ error: "Project name cannot be empty" }, 400);
  }

  const userId = c.get("userId") as string;
  const result = await createProjectForUser(name, userId, db);

  return c.json(result, 201);
}
