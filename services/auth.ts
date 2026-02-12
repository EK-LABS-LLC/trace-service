import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import type { Database } from "../db";
import { user } from "../db/auth-schema";
import { createProjectForUser } from "./admin";

export interface SignupWithProjectInput {
  name?: string;
  email?: string;
  password?: string;
  projectName?: string;
}

type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export class AuthServiceError extends Error {
  status: ApiErrorStatus;

  constructor(message: string, status: ApiErrorStatus = 400) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
  }
}

export async function signupWithProject(input: SignupWithProjectInput, db: Database): Promise<void> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password;
  const projectName = input.projectName?.trim();

  if (!name || !email || !password || !projectName) {
    throw new AuthServiceError("Missing required fields: name, email, password, projectName", 400);
  }

  let createdUserId: string | null = null;

  try {
    const result = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    createdUserId = result.user.id;

    await createProjectForUser(projectName, createdUserId, db);
  } catch (error) {
    if (createdUserId) {
      await db.delete(user).where(eq(user.id, createdUserId));
    }

    const message = error instanceof Error ? error.message : "Sign up failed";
    throw new AuthServiceError(message, 400);
  }
}
