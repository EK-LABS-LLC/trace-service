import type { Context, Next } from "hono";
import { auth } from "../auth/auth";

export async function sessionMiddleware(c: Context, next: Next): Promise<Response | void> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  c.set("userName", session.user.name);
  c.set("userEmail", session.user.email);
  await next();
}
