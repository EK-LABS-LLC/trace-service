import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database as BunSqliteDatabase } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { resolveDataPaths } from "../lib/data-paths";

const dataPaths = resolveDataPaths(process.env);
const databasePath = dataPaths.databasePath;

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new BunSqliteDatabase(databasePath, { create: true });
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA journal_mode = WAL;");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: "./drizzle" });

sqlite.close();
console.log(`Applied migrations to ${databasePath}`);
