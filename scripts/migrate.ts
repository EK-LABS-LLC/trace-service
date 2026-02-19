import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database as BunSqliteDatabase } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const databasePath = process.env.DATABASE_PATH ?? ".data/pulse.db";

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new BunSqliteDatabase(databasePath, { create: true });
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA journal_mode = WAL;");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: "./drizzle" });

sqlite.close();
console.log(`Applied migrations to ${databasePath}`);
