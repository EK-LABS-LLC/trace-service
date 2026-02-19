import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database as BunSqliteDatabase } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { env } from "../config";
import { SqliteStorage } from "./sqlite";
import type { StorageAdapter } from "./adapter";

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

const sqlite = new BunSqliteDatabase(env.DATABASE_PATH, { create: true });
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });
export const storage: StorageAdapter = new SqliteStorage(db);

export async function closeDb(): Promise<void> {
  sqlite.close();
}

export type Database = typeof db;
