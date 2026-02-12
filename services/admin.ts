import { v4 as uuidv4 } from "uuid";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import type { ProjectRole } from "../db/schema";
import { projects, apiKeys, userProjects } from "../db/schema";
import { hashApiKey } from "../auth/queries";
import { normalizeProjectRole } from "./project-roles";

/**
 * Result returned when a project is created.
 */
export interface CreateProjectResult {
  projectId: string;
  apiKey: string;
  name: string;
}

/**
 * API key info returned when listing keys.
 */
export interface ApiKeyInfo {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
}

export interface UserProjectInfo {
  id: string;
  name: string;
  createdAt: Date;
  role: ProjectRole;
}

/**
 * Generate a new API key with the pulse_sk_ prefix.
 */
export function generateApiKey(): string {
  return `pulse_sk_${uuidv4()}`;
}

/**
 * Create a new project with an API key.
 *
 * @param name - The project name
 * @param db - Drizzle database instance
 * @returns The created project info including the plaintext API key (only returned once)
 */
export async function createProject(name: string, db: Database): Promise<CreateProjectResult> {
  return db.transaction(async (tx) => {
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    const [project] = await tx.insert(projects).values({ name }).returning();

    await tx.insert(apiKeys).values({
      projectId: project!.id,
      keyHash,
    });

    return {
      projectId: project!.id,
      apiKey,
      name: project!.name,
    };
  });
}

/**
 * Create a project and attach it to a specific user as admin.
 */
export async function createProjectForUser(
  name: string,
  userId: string,
  db: Database
): Promise<CreateProjectResult> {
  return db.transaction(async (tx) => {
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    const [project] = await tx.insert(projects).values({ name }).returning();

    await tx.insert(apiKeys).values({
      projectId: project!.id,
      keyHash,
    });

    await tx.insert(userProjects).values({
      userId,
      projectId: project!.id,
      role: "admin",
    });

    return {
      projectId: project!.id,
      apiKey,
      name: project!.name,
    };
  });
}

/**
 * List projects the user has access to.
 */
export async function getUserProjects(userId: string, db: Database): Promise<UserProjectInfo[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      role: userProjects.role,
    })
    .from(userProjects)
    .innerJoin(projects, eq(userProjects.projectId, projects.id))
    .where(eq(userProjects.userId, userId));

  return rows.map((row) => ({
    ...row,
    role: normalizeProjectRole(row.role),
  }));
}

/**
 * Get all API keys for a project.
 *
 * @param projectId - The project ID to get keys for
 * @param db - Drizzle database instance
 * @returns List of API keys (without the actual key values, which are hashed)
 */
export async function getApiKeys(projectId: string, db: Database): Promise<ApiKeyInfo[]> {
  const keys = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      projectName: projects.name,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .innerJoin(projects, eq(apiKeys.projectId, projects.id))
    .where(eq(apiKeys.projectId, projectId));

  return keys.map((k) => ({
    id: k.id,
    projectId: k.projectId,
    projectName: k.projectName,
    createdAt: k.createdAt.toISOString(),
  }));
}

/**
 * Delete an API key by ID.
 *
 * @param keyId - The API key ID to delete
 * @param projectId - The project ID (for authorization check)
 * @param db - Drizzle database instance
 * @returns true if deleted, false if not found
 */
export async function deleteApiKey(
  keyId: string,
  projectId: string,
  db: Database
): Promise<boolean> {
  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
    .returning();

  return result.length > 0;
}
