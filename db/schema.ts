import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export type ProjectRole = "admin" | "user";

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow().notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  keyHash: text("key_hash").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  name: text("name").notNull().default("Default Key"),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow().notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow().notNull(),
  metadata: text("metadata", { mode: "json" }),
});

export const traces = sqliteTable(
  "traces",
  {
    traceId: text("trace_id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: text("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).defaultNow().notNull(),
    latencyMs: integer("latency_ms").notNull(),
    provider: text("provider").notNull(),
    modelRequested: text("model_requested").notNull(),
    modelUsed: text("model_used"),
    providerRequestId: text("provider_request_id"),
    requestBody: text("request_body", { mode: "json" }).notNull(),
    responseBody: text("response_body", { mode: "json" }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    outputText: text("output_text"),
    finishReason: text("finish_reason"),
    status: text("status").notNull(),
    error: text("error", { mode: "json" }),
    costCents: real("cost_cents"),
    metadata: text("metadata", { mode: "json" }),
  },
  (table) => [
    index("traces_project_timestamp_idx").on(table.projectId, table.timestamp),
    index("traces_project_session_idx").on(table.projectId, table.sessionId),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export const userProjects = sqliteTable(
  "user_projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull().default("user"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  (table) => [
    index("user_projects_user_idx").on(table.userId),
    index("user_projects_project_idx").on(table.projectId),
    uniqueIndex("user_projects_user_project_unique_idx").on(
      table.userId,
      table.projectId,
    ),
  ],
);

export type UserProject = typeof userProjects.$inferSelect;
export type NewUserProject = typeof userProjects.$inferInsert;

export type Trace = typeof traces.$inferSelect;
export type NewTrace = typeof traces.$inferInsert;

export const spans = sqliteTable(
  "spans",
  {
    spanId: text("span_id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: text("session_id").notNull(),
    parentSpanId: text("parent_span_id"),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).defaultNow().notNull(),
    durationMs: integer("duration_ms"),
    source: text("source").notNull(),
    kind: text("kind").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    toolUseId: text("tool_use_id"),
    toolName: text("tool_name"),
    toolInput: text("tool_input", { mode: "json" }),
    toolResponse: text("tool_response", { mode: "json" }),
    error: text("error", { mode: "json" }),
    isInterrupt: integer("is_interrupt", { mode: "boolean" }),
    cwd: text("cwd"),
    model: text("model"),
    agentName: text("agent_name"),
    metadata: text("metadata", { mode: "json" }),
  },
  (table) => [
    index("spans_project_timestamp_idx").on(table.projectId, table.timestamp),
    index("spans_project_session_idx").on(table.projectId, table.sessionId),
    index("spans_project_kind_idx").on(table.projectId, table.kind),
  ],
);

export type Span = typeof spans.$inferSelect;
export type NewSpan = typeof spans.$inferInsert;
