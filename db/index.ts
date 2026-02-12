import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../config";

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });

export async function closeDb(): Promise<void> {
  await client.end();
}

export type Database = typeof db;
