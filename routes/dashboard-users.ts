import type { Context } from "hono";
import { db } from "../db";
import {
  createProjectUser,
  getProjectUsers,
  ProjectUsersServiceError,
  type CreateProjectUserInput,
} from "../services/project-users";

export async function handleGetProjectUsers(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const users = await getProjectUsers(projectId, db);
  return c.json({ users });
}

export async function handleCreateProjectUser(c: Context): Promise<Response> {
  let body: CreateProjectUserInput;
  try {
    body = await c.req.json<CreateProjectUserInput>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const projectId = c.get("projectId") as string;
    const user = await createProjectUser(projectId, body, db);
    return c.json({ user }, 201);
  } catch (error) {
    if (error instanceof ProjectUsersServiceError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
}
