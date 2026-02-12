import type { Context } from "hono";

/**
 * Global error handler for unhandled exceptions.
 * Logs the full error stack and returns a 500 response.
 */
export function errorHandler(err: Error, c: Context) {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} ERROR: ${err.message}`);
  console.error(err.stack);

  return c.json({ error: "Internal server error" }, 500);
}
