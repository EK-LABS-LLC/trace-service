import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { env } from "../config";

// Ensure .data directory exists
const dbPath = env.DATABASE_URL.replace("file:", "");
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
// Enable WAL mode for better concurrency
sqlite.exec("PRAGMA journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export async function closeDb(): Promise<void> {
  sqlite.close();
}

export type Database = typeof db;
