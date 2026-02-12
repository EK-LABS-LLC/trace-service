import type { Context } from "hono";
import { db } from "../db";
import { hashApiKey, getProjectIdByKeyHash } from "../auth/queries";

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] || null;
}

/**
 * Validate an API token and return authentication status.
 * POST /login
 */
export async function isAuthenticated(c: Context): Promise<Response> {
  const authHeader = c.req.header("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return c.json({ authenticated: false }, 200);
  }

  const keyHash = hashApiKey(token);
  const projectId = await getProjectIdByKeyHash(keyHash, db);

  return c.json({ authenticated: projectId !== null }, 200);
}
