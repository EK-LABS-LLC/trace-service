import type { Context, Next } from "hono";
import { env } from "../config";

/**
 * Admin authentication middleware for protected admin routes.
 * Validates X-Admin-Key header or admin_key query param against ADMIN_KEY env var.
 */
export async function adminAuthMiddleware(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const adminKey = env.ADMIN_KEY;

  if (!adminKey) {
    return c.json({ error: "Admin API is not configured" }, 503);
  }

  const headerKey = c.req.header("X-Admin-Key");
  const queryKey = c.req.query("admin_key");
  const providedKey = headerKey || queryKey;

  if (!providedKey) {
    return c.json({ error: "Missing admin key" }, 401);
  }

  if (providedKey !== adminKey) {
    return c.json({ error: "Invalid admin key" }, 401);
  }

  await next();
}
