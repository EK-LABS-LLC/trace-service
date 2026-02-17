import type { Context, Next } from "hono";
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
 * Authentication middleware for protected routes.
 * Validates API key and sets projectId in context.
 */
export async function authMiddleware(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    console.error(
      `[auth] FAILED - Missing or invalid Authorization header - ${c.req.method} ${c.req.path}`,
    );
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const keyHash = hashApiKey(token);
  const projectId = await getProjectIdByKeyHash(keyHash, db);

  if (!projectId) {
    console.error(
      `[auth] FAILED - Invalid API key - ${c.req.method} ${c.req.path} - token=${token.slice(0, 10)}...`,
    );
    return c.json({ error: "Invalid API key" }, 401);
  }

  console.log(
    `[auth] SUCCESS - ${c.req.method} ${c.req.path} - project=${projectId}`,
  );
  c.set("projectId", projectId);
  await next();
}
