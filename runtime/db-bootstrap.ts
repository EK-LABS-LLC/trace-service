import type { Database as BunSqliteDatabase } from "bun:sqlite";
import type { Sql } from "postgres";

const SQLITE_BOOTSTRAP_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "email_verified" integer DEFAULT false NOT NULL,
    "image" text,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "updated_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "access_token" text,
    "refresh_token" text,
    "access_token_expires_at" integer,
    "refresh_token_expires_at" integer,
    "scope" text,
    "id_token" text,
    "password" text,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "updated_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE TABLE IF NOT EXISTS "auth_session" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "token" text NOT NULL,
    "expires_at" integer NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "updated_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "auth_session_token_unique" ON "auth_session" ("token");`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" text PRIMARY KEY NOT NULL,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" integer NOT NULL,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "updated_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "key_hash" text NOT NULL,
    "encrypted_key" text NOT NULL,
    "name" text DEFAULT 'Default Key' NOT NULL,
    "last_used_at" integer,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE TABLE IF NOT EXISTS "sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "metadata" text,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE TABLE IF NOT EXISTS "traces" (
    "trace_id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "session_id" text,
    "timestamp" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "latency_ms" integer NOT NULL,
    "provider" text NOT NULL,
    "model_requested" text NOT NULL,
    "model_used" text,
    "provider_request_id" text,
    "request_body" text NOT NULL,
    "response_body" text,
    "input_tokens" integer,
    "output_tokens" integer,
    "output_text" text,
    "finish_reason" text,
    "status" text NOT NULL,
    "error" text,
    "cost_cents" real,
    "metadata" text,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE set null
  );`,
  `CREATE INDEX IF NOT EXISTS "traces_project_timestamp_idx" ON "traces" ("project_id", "timestamp");`,
  `CREATE INDEX IF NOT EXISTS "traces_project_session_idx" ON "traces" ("project_id", "session_id");`,
  `CREATE TABLE IF NOT EXISTS "trace_summaries" (
    "trace_id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "session_id" text,
    "root_span_id" text,
    "name" text NOT NULL,
    "source" text NOT NULL,
    "started_at" integer NOT NULL,
    "ended_at" integer NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "status" text NOT NULL,
    "span_count" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cost_cents" real DEFAULT 0 NOT NULL,
    "attributes" text,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS "trace_summaries_project_started_idx" ON "trace_summaries" ("project_id", "started_at");`,
  `CREATE INDEX IF NOT EXISTS "trace_summaries_project_session_idx" ON "trace_summaries" ("project_id", "session_id");`,
  `CREATE TABLE IF NOT EXISTS "spans" (
    "span_id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "trace_id" text,
    "session_id" text NOT NULL,
    "parent_span_id" text,
    "name" text,
    "otel_kind" text,
    "start_time_unix_nano" text,
    "end_time_unix_nano" text,
    "status_code" text,
    "status_message" text,
    "attributes" text,
    "events" text,
    "links" text,
    "resource" text,
    "scope" text,
    "timestamp" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    "duration_ms" integer,
    "source" text NOT NULL,
    "kind" text NOT NULL,
    "event_type" text NOT NULL,
    "status" text NOT NULL,
    "tool_use_id" text,
    "tool_name" text,
    "tool_input" text,
    "tool_response" text,
    "error" text,
    "is_interrupt" integer,
    "cwd" text,
    "model" text,
    "agent_name" text,
    "metadata" text,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS "spans_project_timestamp_idx" ON "spans" ("project_id", "timestamp");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_session_idx" ON "spans" ("project_id", "session_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_trace_idx" ON "spans" ("project_id", "trace_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_kind_idx" ON "spans" ("project_id", "kind");`,
  `CREATE TABLE IF NOT EXISTS "user_projects" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "project_id" text NOT NULL,
    "role" text DEFAULT 'user' NOT NULL,
    "created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS "user_projects_user_idx" ON "user_projects" ("user_id");`,
  `CREATE INDEX IF NOT EXISTS "user_projects_project_idx" ON "user_projects" ("project_id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_projects_user_project_unique_idx" ON "user_projects" ("user_id", "project_id");`,
];

const POSTGRES_BOOTSTRAP_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "image" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "access_token" text,
    "refresh_token" text,
    "access_token_expires_at" timestamp with time zone,
    "refresh_token_expires_at" timestamp with time zone,
    "scope" text,
    "id_token" text,
    "password" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE TABLE IF NOT EXISTS "auth_session" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "token" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "auth_session_token_unique" ON "auth_session" ("token");`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" text PRIMARY KEY NOT NULL,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "key_hash" text NOT NULL,
    "encrypted_key" text NOT NULL,
    "name" text DEFAULT 'Default Key' NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE TABLE IF NOT EXISTS "sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "metadata" jsonb,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE TABLE IF NOT EXISTS "traces" (
    "trace_id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "session_id" text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    "latency_ms" integer NOT NULL,
    "provider" text NOT NULL,
    "model_requested" text NOT NULL,
    "model_used" text,
    "provider_request_id" text,
    "request_body" jsonb NOT NULL,
    "response_body" jsonb,
    "input_tokens" integer,
    "output_tokens" integer,
    "output_text" text,
    "finish_reason" text,
    "status" text NOT NULL,
    "error" jsonb,
    "cost_cents" double precision,
    "metadata" jsonb,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE set null
  );`,
  `CREATE INDEX IF NOT EXISTS "traces_project_timestamp_idx" ON "traces" ("project_id", "timestamp");`,
  `CREATE INDEX IF NOT EXISTS "traces_project_session_idx" ON "traces" ("project_id", "session_id");`,
  `CREATE TABLE IF NOT EXISTS "trace_summaries" (
    "trace_id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "session_id" text,
    "root_span_id" text,
    "name" text NOT NULL,
    "source" text NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "status" text NOT NULL,
    "span_count" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cost_cents" double precision DEFAULT 0 NOT NULL,
    "attributes" jsonb,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS "trace_summaries_project_started_idx" ON "trace_summaries" ("project_id", "started_at");`,
  `CREATE INDEX IF NOT EXISTS "trace_summaries_project_session_idx" ON "trace_summaries" ("project_id", "session_id");`,
  `CREATE TABLE IF NOT EXISTS "spans" (
    "span_id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "trace_id" text,
    "session_id" text NOT NULL,
    "parent_span_id" text,
    "name" text,
    "otel_kind" text,
    "start_time_unix_nano" text,
    "end_time_unix_nano" text,
    "status_code" text,
    "status_message" text,
    "attributes" jsonb,
    "events" jsonb,
    "links" jsonb,
    "resource" jsonb,
    "scope" jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    "duration_ms" integer,
    "source" text NOT NULL,
    "kind" text NOT NULL,
    "event_type" text NOT NULL,
    "status" text NOT NULL,
    "tool_use_id" text,
    "tool_name" text,
    "tool_input" jsonb,
    "tool_response" jsonb,
    "error" jsonb,
    "is_interrupt" boolean,
    "cwd" text,
    "model" text,
    "agent_name" text,
    "metadata" jsonb,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS "spans_project_timestamp_idx" ON "spans" ("project_id", "timestamp");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_session_idx" ON "spans" ("project_id", "session_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_trace_idx" ON "spans" ("project_id", "trace_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_kind_idx" ON "spans" ("project_id", "kind");`,
  `CREATE TABLE IF NOT EXISTS "user_projects" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "project_id" text NOT NULL,
    "role" text DEFAULT 'user' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS "user_projects_user_idx" ON "user_projects" ("user_id");`,
  `CREATE INDEX IF NOT EXISTS "user_projects_project_idx" ON "user_projects" ("project_id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_projects_user_project_unique_idx" ON "user_projects" ("user_id", "project_id");`,
];

const POSTGRES_BOOTSTRAP_LOCK_KEY = "pulse_schema_bootstrap_v1";

const SQLITE_SPAN_COLUMNS: readonly Array<{ name: string; ddl: string }> = [
  { name: "trace_id", ddl: `ALTER TABLE "spans" ADD COLUMN "trace_id" text;` },
  { name: "name", ddl: `ALTER TABLE "spans" ADD COLUMN "name" text;` },
  { name: "otel_kind", ddl: `ALTER TABLE "spans" ADD COLUMN "otel_kind" text;` },
  {
    name: "start_time_unix_nano",
    ddl: `ALTER TABLE "spans" ADD COLUMN "start_time_unix_nano" text;`,
  },
  {
    name: "end_time_unix_nano",
    ddl: `ALTER TABLE "spans" ADD COLUMN "end_time_unix_nano" text;`,
  },
  { name: "status_code", ddl: `ALTER TABLE "spans" ADD COLUMN "status_code" text;` },
  { name: "status_message", ddl: `ALTER TABLE "spans" ADD COLUMN "status_message" text;` },
  { name: "attributes", ddl: `ALTER TABLE "spans" ADD COLUMN "attributes" text;` },
  { name: "events", ddl: `ALTER TABLE "spans" ADD COLUMN "events" text;` },
  { name: "links", ddl: `ALTER TABLE "spans" ADD COLUMN "links" text;` },
  { name: "resource", ddl: `ALTER TABLE "spans" ADD COLUMN "resource" text;` },
  { name: "scope", ddl: `ALTER TABLE "spans" ADD COLUMN "scope" text;` },
];

const POSTGRES_SPAN_COLUMN_STATEMENTS: readonly string[] = [
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "trace_id" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "name" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "otel_kind" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "start_time_unix_nano" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "end_time_unix_nano" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "status_code" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "status_message" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "attributes" jsonb;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "events" jsonb;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "links" jsonb;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "resource" jsonb;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "scope" jsonb;`,
];

export function bootstrapSqliteSchema(sqlite: BunSqliteDatabase): void {
  for (const statement of SQLITE_BOOTSTRAP_STATEMENTS) {
    sqlite.exec(statement);
  }

  const existingSpanColumns = new Set(
    sqlite.query(`PRAGMA table_info("spans")`).all().map((row: any) => String(row.name)),
  );
  for (const column of SQLITE_SPAN_COLUMNS) {
    if (!existingSpanColumns.has(column.name)) {
      sqlite.exec(column.ddl);
    }
  }
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS "spans_project_trace_idx" ON "spans" ("project_id", "trace_id");`,
  );
}

export async function bootstrapPostgresSchema(sql: Sql): Promise<void> {
  await sql`SELECT pg_advisory_lock(hashtext(${POSTGRES_BOOTSTRAP_LOCK_KEY}))`;
  try {
    for (const statement of POSTGRES_BOOTSTRAP_STATEMENTS) {
      await sql.unsafe(statement);
    }
    for (const statement of POSTGRES_SPAN_COLUMN_STATEMENTS) {
      await sql.unsafe(statement);
    }
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS "spans_project_trace_idx" ON "spans" ("project_id", "trace_id");`,
    );
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext(${POSTGRES_BOOTSTRAP_LOCK_KEY}))`;
  }
}
