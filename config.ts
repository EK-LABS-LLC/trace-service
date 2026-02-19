import { z } from "zod";

const envSchema = z.object({
  PULSE_MODE: z.enum(["single", "scale"]).default("single"),
  DATABASE_PATH: z.string().default(".data/pulse.db"),
  DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ADMIN_KEY: z.string().optional(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be at least 32 characters"),

  // WAL Configuration
  WAL_DIR: z.string().default(".data/wal"),
  WAL_SPAN_DIR: z.string().default(".data/wal-spans"),
  WAL_MAX_SEGMENT_SIZE: z.coerce.number().default(100 * 1024 * 1024), // 100MB
  WAL_MAX_SEGMENT_AGE: z.coerce.number().default(24 * 60 * 60 * 1000), // 24 hours
  WAL_MAX_SEGMENT_LINES: z.coerce.number().default(100000),
  WAL_FSYNC_EVERY: z.coerce.number().default(1), // fsync every write (0 = fsync on close only)
  WAL_MAX_SEGMENTS: z.coerce.number().default(10),
  WAL_MAX_RETENTION_AGE: z.coerce.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
  WAL_PROCESSING_BATCH_SIZE: z.coerce.number().default(100),
  WAL_PROCESSING_INTERVAL_MS: z.coerce.number().default(100),
  WAL_MAX_RETRIES: z.coerce.number().default(3),
  WAL_DLQ_DIR: z.string().default(".data/wal/dead-letter"),
  TRACE_WAL_PARTITIONS: z.coerce.number().int().min(1).optional(),
  SPAN_WAL_PARTITIONS: z.coerce.number().int().min(1).optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    result.error.issues.forEach((err) => {
      console.error(`  ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }

  const env = result.data;

  if (env.PULSE_MODE === "scale") {
    if (!env.DATABASE_URL) {
      console.error(
        "Invalid environment configuration: DATABASE_URL is required in scale mode",
      );
      process.exit(1);
    }

    if (
      !env.DATABASE_URL.startsWith("postgres://") &&
      !env.DATABASE_URL.startsWith("postgresql://")
    ) {
      console.error(
        "Invalid DATABASE_URL: PostgreSQL URL required (expected postgres:// or postgresql://)",
      );
      process.exit(1);
    }
  }

  return {
    ...env,
    DATABASE_URL: env.DATABASE_URL ?? "",
    TRACE_WAL_PARTITIONS: env.TRACE_WAL_PARTITIONS ?? (env.PULSE_MODE === "scale" ? 4 : 1),
    SPAN_WAL_PARTITIONS: env.SPAN_WAL_PARTITIONS ?? (env.PULSE_MODE === "scale" ? 4 : 1),
  };
}

export const env = parseEnv();
