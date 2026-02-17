import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { apiKeys } from "../db/schema";

/**
 * Hash an API key using SHA-256 for storage and lookup.
 * Uses deterministic hashing to allow efficient database lookups.
 */
export function hashApiKey(key: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(key);
  return hasher.digest("hex");
}

/**
 * Look up a project ID by API key hash.
 * @param keyHash - The hashed API key to look up
 * @param db - Drizzle database instance
 * @returns The project ID if found, null otherwise
 */
export async function getProjectIdByKeyHash(
  keyHash: string,
  db: Database,
): Promise<string | null> {
  const [result] = await db
    .select({ projectId: apiKeys.projectId })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  return result?.projectId ?? null;
}
