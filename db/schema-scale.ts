import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema-scale";

export * from "./auth-schema-scale";

export type ProjectRole = "admin" | "user";

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  keyHash: text("key_hash").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  name: text("name").notNull().default("Default Key"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export const userProjects = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const spans = pgTable(
  "spans",
  {
    spanId: text("span_id").notNull(),
    traceId: text("trace_id"),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: text("session_id").notNull(),
    parentSpanId: text("parent_span_id"),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .defaultNow()
      .notNull(),
    durationMs: integer("duration_ms"),
    source: text("source").notNull(),
    kind: text("kind").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    toolUseId: text("tool_use_id"),
    toolName: text("tool_name"),
    toolInput: jsonb("tool_input"),
    toolResponse: jsonb("tool_response"),
    error: jsonb("error"),
    isInterrupt: boolean("is_interrupt"),
    cwd: text("cwd"),
    model: text("model"),
    agentName: text("agent_name"),
    provider: text("provider"),
    modelUsed: text("model_used"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costCents: doublePrecision("cost_cents"),
    finishReason: text("finish_reason"),
    outputText: text("output_text"),
    providerRequestId: text("provider_request_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.spanId] }),
    index("spans_project_timestamp_idx").on(table.projectId, table.timestamp),
    index("spans_project_trace_idx").on(table.projectId, table.traceId),
    index("spans_project_session_idx").on(table.projectId, table.sessionId),
    index("spans_project_kind_idx").on(table.projectId, table.kind),
  ],
);

export type Span = typeof spans.$inferSelect;
export type NewSpan = typeof spans.$inferInsert;
