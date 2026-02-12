import type { Context, Next } from "hono";

/**
 * Request logging middleware.
 * Logs method, path, status, and duration for each request.
 */
export async function logger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  const timestamp = new Date().toISOString();

  console.log(`${timestamp} ${method} ${path} ${status} ${duration}ms`);
}
