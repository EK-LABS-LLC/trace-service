import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../../config";
import * as schema from "../../db/schema-scale";
import * as authSchema from "../../db/auth-schema-scale";
import { PostgresStorage } from "../../db/postgres";
import { createAuth } from "../../auth/create-auth";
import type { RuntimeServices } from "../services";

export function createScaleRuntimeServices(): RuntimeServices {
  const sql = postgres(env.DATABASE_URL);
  const db = drizzle(sql, { schema });
  const storage = new PostgresStorage(db);
  const auth = createAuth(db, "pg", authSchema);

  return {
    db,
    storage,
    auth,
    schema,
    authSchema,
    dbProvider: "pg",
    dbDialect: "postgres",
    closeDb: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
