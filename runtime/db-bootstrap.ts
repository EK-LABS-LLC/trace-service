import type { Database as BunSqliteDatabase } from "bun:sqlite";
import type { Sql } from "postgres";

const SQLITE_SPANS_TABLE_BODY = `(
    "span_id" text NOT NULL,
    "trace_id" text,
    "project_id" text NOT NULL,
    "session_id" text NOT NULL,
    "parent_span_id" text,
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
    "provider" text,
    "model_used" text,
    "input_tokens" integer,
    "output_tokens" integer,
    "cost_cents" real,
    "finish_reason" text,
    "output_text" text,
    "provider_request_id" text,
    "metadata" text,
    PRIMARY KEY ("project_id", "span_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  )`;

const SQLITE_SPANS_INDEX_STATEMENTS: readonly string[] = [
  `CREATE INDEX IF NOT EXISTS "spans_project_timestamp_idx" ON "spans" ("project_id", "timestamp");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_trace_idx" ON "spans" ("project_id", "trace_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_session_idx" ON "spans" ("project_id", "session_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_kind_idx" ON "spans" ("project_id", "kind");`,
];

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
  `CREATE TABLE IF NOT EXISTS "spans" ${SQLITE_SPANS_TABLE_BODY};`,
  `ALTER TABLE "spans" ADD COLUMN "trace_id" text;`,
  `ALTER TABLE "spans" ADD COLUMN "provider" text;`,
  `ALTER TABLE "spans" ADD COLUMN "model_used" text;`,
  `ALTER TABLE "spans" ADD COLUMN "input_tokens" integer;`,
  `ALTER TABLE "spans" ADD COLUMN "output_tokens" integer;`,
  `ALTER TABLE "spans" ADD COLUMN "cost_cents" real;`,
  `ALTER TABLE "spans" ADD COLUMN "finish_reason" text;`,
  `ALTER TABLE "spans" ADD COLUMN "output_text" text;`,
  `ALTER TABLE "spans" ADD COLUMN "provider_request_id" text;`,
  ...SQLITE_SPANS_INDEX_STATEMENTS,
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
  `CREATE TABLE IF NOT EXISTS "spans" (
    "span_id" text NOT NULL,
    "trace_id" text,
    "project_id" text NOT NULL,
    "session_id" text NOT NULL,
    "parent_span_id" text,
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
    "provider" text,
    "model_used" text,
    "input_tokens" integer,
    "output_tokens" integer,
    "cost_cents" double precision,
    "finish_reason" text,
    "output_text" text,
    "provider_request_id" text,
    "metadata" jsonb,
    PRIMARY KEY ("project_id", "span_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
  );`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "trace_id" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "provider" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "model_used" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "input_tokens" integer;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "output_tokens" integer;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "cost_cents" double precision;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "finish_reason" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "output_text" text;`,
  `ALTER TABLE "spans" ADD COLUMN IF NOT EXISTS "provider_request_id" text;`,
  `DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'spans'::regclass
        AND c.contype = 'p'
        AND (
          SELECT array_agg(a.attname::text ORDER BY k.ord)
          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ) <> ARRAY['project_id', 'span_id']
    ) THEN
      ALTER TABLE "spans" DROP CONSTRAINT "spans_pkey";
      ALTER TABLE "spans" ADD PRIMARY KEY ("project_id", "span_id");
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS "spans_project_timestamp_idx" ON "spans" ("project_id", "timestamp");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_trace_idx" ON "spans" ("project_id", "trace_id");`,
  `CREATE INDEX IF NOT EXISTS "spans_project_session_idx" ON "spans" ("project_id", "session_id");`,
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

export function bootstrapSqliteSchema(sqlite: BunSqliteDatabase): void {
  for (const statement of SQLITE_BOOTSTRAP_STATEMENTS) {
    try {
      sqlite.exec(statement);
    } catch (error) {
      if (
        !statement.startsWith("ALTER TABLE") ||
        !String(error).includes("duplicate column")
      ) {
        throw error;
      }
    }
  }
  migrateSqliteSpansPrimaryKey(sqlite);
}

/**
 * SQLite cannot alter a primary key in place, so databases created before the
 * composite (project_id, span_id) key are rebuilt via copy-and-rename.
 */
function migrateSqliteSpansPrimaryKey(sqlite: BunSqliteDatabase): void {
  const columns = sqlite.query(`PRAGMA table_info("spans")`).all() as Array<{
    name: string;
    pk: number;
  }>;
  const pkColumns = columns
    .filter((column) => column.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((column) => column.name);
  if (
    pkColumns.length === 2 &&
    pkColumns[0] === "project_id" &&
    pkColumns[1] === "span_id"
  ) {
    return;
  }

  // The ADD COLUMN statements above ran first, so the old table already has
  // every column in the new definition and a plain column-for-column copy works.
  const columnList = columns.map((column) => `"${column.name}"`).join(", ");
  sqlite.exec("PRAGMA foreign_keys = OFF;");
  try {
    sqlite.exec("BEGIN;");
    try {
      sqlite.exec(`CREATE TABLE "spans_rebuild" ${SQLITE_SPANS_TABLE_BODY};`);
      sqlite.exec(
        `INSERT INTO "spans_rebuild" (${columnList}) SELECT ${columnList} FROM "spans";`,
      );
      sqlite.exec(`DROP TABLE "spans";`);
      sqlite.exec(`ALTER TABLE "spans_rebuild" RENAME TO "spans";`);
      for (const statement of SQLITE_SPANS_INDEX_STATEMENTS) {
        sqlite.exec(statement);
      }
      sqlite.exec("COMMIT;");
    } catch (error) {
      sqlite.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    sqlite.exec("PRAGMA foreign_keys = ON;");
  }
}

export async function bootstrapPostgresSchema(sql: Sql): Promise<void> {
  await sql`SELECT pg_advisory_lock(hashtext(${POSTGRES_BOOTSTRAP_LOCK_KEY}))`;
  try {
    for (const statement of POSTGRES_BOOTSTRAP_STATEMENTS) {
      await sql.unsafe(statement);
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext(${POSTGRES_BOOTSTRAP_LOCK_KEY}))`;
  }
}
