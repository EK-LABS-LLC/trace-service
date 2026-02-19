import type { StorageAdapter } from "../db/adapter";

export interface RuntimeServices {
  db: any;
  storage: StorageAdapter;
  auth: any;
  schema: Record<string, any>;
  authSchema: Record<string, any>;
  dbProvider: "sqlite" | "pg";
  dbDialect: "sqlite" | "postgres";
  closeDb: () => Promise<void>;
}

let runtimeServices: RuntimeServices | null = null;

export function initializeRuntimeServices(services: RuntimeServices): void {
  if (runtimeServices) {
    throw new Error("Runtime services are already initialized");
  }
  runtimeServices = services;
}

export function getRuntimeServices(): RuntimeServices {
  if (!runtimeServices) {
    throw new Error(
      "Runtime services are not initialized. Start via pulse.ts or pulse-scale.ts",
    );
  }
  return runtimeServices;
}
