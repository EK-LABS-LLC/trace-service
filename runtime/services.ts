import type { StorageAdapter } from "../db/adapter";

type DrizzleAdapterDb =
  Parameters<typeof import("better-auth/adapters/drizzle").drizzleAdapter>[0];
type BetterAuthInstance = ReturnType<typeof import("better-auth").betterAuth>;

export interface RuntimeServices {
  db: DrizzleAdapterDb;
  storage: StorageAdapter;
  auth: BetterAuthInstance;
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
      "Runtime services are not initialized. Start via pulse.ts (set PULSE_MODE=single|scale).",
    );
  }
  return runtimeServices;
}
