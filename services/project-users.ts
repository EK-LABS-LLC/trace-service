import { and, eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import type { Database } from "../db";
import type { ProjectRole } from "../db/schema";
import { userProjects } from "../db/schema";
import { user } from "../db/auth-schema";
import { normalizeProjectRole } from "./project-roles";

type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export class ProjectUsersServiceError extends Error {
  status: ApiErrorStatus;

  constructor(message: string, status: ApiErrorStatus = 400) {
    super(message);
    this.name = "ProjectUsersServiceError";
    this.status = status;
  }
}

export interface ProjectUserInfo {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  createdAt: string;
}

export interface CreateProjectUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: ProjectRole;
}

export async function getProjectUsers(
  projectId: string,
  db: Database,
): Promise<ProjectUserInfo[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: userProjects.role,
      createdAt: userProjects.createdAt,
    })
    .from(userProjects)
    .innerJoin(user, eq(userProjects.userId, user.id))
    .where(eq(userProjects.projectId, projectId));

  return rows.map((row: any) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: normalizeProjectRole(row.role),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createProjectUser(
  projectId: string,
  input: CreateProjectUserInput,
  db: Database,
): Promise<ProjectUserInfo> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password;
  const role: ProjectRole = input.role === "admin" ? "admin" : "user";

  if (!email) {
    throw new ProjectUsersServiceError("Missing required field: email", 400);
  }

  const [existingUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existingUser) {
    const [existingMembership] = await db
      .select({ id: userProjects.id })
      .from(userProjects)
      .where(
        and(
          eq(userProjects.userId, existingUser.id),
          eq(userProjects.projectId, projectId),
        ),
      )
      .limit(1);

    if (existingMembership) {
      throw new ProjectUsersServiceError(
        "User is already a member of this project",
        409,
      );
    }

    const [membership] = await db
      .insert(userProjects)
      .values({
        userId: existingUser.id,
        projectId,
        role,
      })
      .returning({
        createdAt: userProjects.createdAt,
      });

    return {
      userId: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role,
      createdAt: membership!.createdAt.toISOString(),
    };
  }

  if (!name || !password) {
    throw new ProjectUsersServiceError(
      "Missing required fields for new user: name, password",
      400,
    );
  }

  let createdUserId: string | null = null;

  try {
    const signupResult = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    createdUserId = signupResult.user.id;

    const [membership] = await db
      .insert(userProjects)
      .values({
        userId: createdUserId,
        projectId,
        role,
      })
      .returning({
        createdAt: userProjects.createdAt,
      });

    return {
      userId: signupResult.user.id,
      name: signupResult.user.name,
      email: signupResult.user.email,
      role,
      createdAt: membership!.createdAt.toISOString(),
    };
  } catch (error) {
    if (createdUserId) {
      await db.delete(user).where(eq(user.id, createdUserId));
    }

    const message =
      error instanceof Error ? error.message : "Failed to create project user";
    throw new ProjectUsersServiceError(message, 400);
  }
}
