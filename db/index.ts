import { getRuntimeServices } from "../runtime/services";

const runtime = getRuntimeServices();

export const db = runtime.db;
export const storage = runtime.storage;

export function getDbProvider(): "sqlite" | "pg" {
  return runtime.dbProvider;
}

export function getDbDialect(): "sqlite" | "postgres" {
  return runtime.dbDialect;
}

export async function closeDb(): Promise<void> {
  await runtime.closeDb();
}

export type Database = any;
