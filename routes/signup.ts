import type { Context } from "hono";
import { db } from "../db";
import {
  AuthServiceError,
  signupWithProject,
  type SignupWithProjectInput,
} from "../services/auth";

export async function handleSignupWithProject(c: Context): Promise<Response> {
  let body: SignupWithProjectInput;
  try {
    body = await c.req.json<SignupWithProjectInput>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    await signupWithProject(body, db);

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
}
