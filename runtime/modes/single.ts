import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database as BunSqliteDatabase } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { env } from "../../config";
import * as schema from "../../db/schema-single";
import * as authSchema from "../../db/auth-schema-single";
import { SqliteStorage } from "../../db/sqlite";
import { createAuth } from "../../auth/create-auth";
import type { RuntimeServices } from "../services";

export function createSingleRuntimeServices(): RuntimeServices {
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

  const sqlite = new BunSqliteDatabase(env.DATABASE_PATH, { create: true });
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA journal_mode = WAL;");

  const db = drizzle(sqlite, { schema });
  const storage = new SqliteStorage(db);
  const auth = createAuth(db, "sqlite", {
    user: authSchema.user,
    session: authSchema.authSession,
    account: authSchema.account,
    verification: authSchema.verification,
  });

  return {
    db,
    storage,
    auth,
    schema,
    authSchema,
    dbProvider: "sqlite",
    dbDialect: "sqlite",
    closeDb: async () => {
      sqlite.close();
    },
  };
}
