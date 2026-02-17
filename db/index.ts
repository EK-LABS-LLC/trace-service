import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "../config";
import { PostgresStorage } from "./postgres";
import type { StorageAdapter } from "./adapter";

const sql = postgres(env.DATABASE_URL);
export const db = drizzle(sql, { schema });
export const storage: StorageAdapter = new PostgresStorage(db);

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export type Database = typeof db;
