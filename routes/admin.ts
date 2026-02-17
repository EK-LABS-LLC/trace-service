import type { Context } from "hono";
import {
  createProject,
  getApiKeys,
  deleteApiKey,
  createApiKey,
  updateApiKeyName,
} from "../services/admin";
import { db } from "../db";

/**
 * Handler for POST /admin/projects
 * Creates a new project and returns the project info with API key.
 */
export async function handleCreateProject(c: Context): Promise<Response> {
  const body = await c.req.json<{ name?: string }>();

  if (!body.name || typeof body.name !== "string") {
    return c.json({ error: "Missing required field: name" }, 400);
  }

  const name = body.name.trim();
  if (name.length === 0) {
    return c.json({ error: "Project name cannot be empty" }, 400);
  }

  const result = await createProject(name, db);

  return c.json(result, 201);
}

/**
 * Handler for GET /admin/api-keys
 * Returns all API keys for the authenticated project.
 */
export async function handleGetApiKeys(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const keys = await getApiKeys(projectId, db);
  return c.json({ keys });
}

/**
 * Handler for DELETE /admin/api-keys/:id
 * Deletes an API key by ID.
 */
export async function handleDeleteApiKey(c: Context): Promise<Response> {
  const keyId = c.req.param("id");
  const projectId = c.get("projectId") as string;

  if (!keyId) {
    return c.json({ error: "Missing key ID" }, 400);
  }

  const deleted = await deleteApiKey(keyId, projectId, db);

  if (!deleted) {
    return c.json({ error: "API key not found" }, 404);
  }

  return c.json({ success: true });
}

/**
 * Handler for POST /admin/api-keys
 * Creates a new API key for the current project.
 */
export async function handleCreateApiKey(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;

  try {
    const body = await c.req.json<{ name?: string }>();
    const name = body?.name || "API Key";

    const apiKey = await createApiKey(projectId, name, db);

    return c.json({ apiKey }, 201);
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
}

/**
 * Handler for PATCH /admin/api-keys/:id
 * Updates an API key's name.
 */
export async function handleUpdateApiKey(c: Context): Promise<Response> {
  const keyId = c.req.param("id");
  const projectId = c.get("projectId") as string;

  if (!keyId) {
    return c.json({ error: "Missing key ID" }, 400);
  }

  try {
    const body = await c.req.json<{ name: string }>();

    if (!body.name || typeof body.name !== "string") {
      return c.json({ error: "Missing or invalid 'name' field" }, 400);
    }

    const updated = await updateApiKeyName(keyId, projectId, body.name, db);

    if (!updated) {
      return c.json({ error: "API key not found" }, 404);
    }

    return c.json({ success: true });
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
}
