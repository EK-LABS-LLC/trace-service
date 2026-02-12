import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  text,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export type ProjectRole = "admin" | "user";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  metadata: jsonb("metadata"),
});

export const traces = pgTable(
  "traces",
  {
    traceId: uuid("trace_id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .defaultNow()
      .notNull(),
    latencyMs: integer("latency_ms").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    modelRequested: varchar("model_requested", { length: 255 }).notNull(),
    modelUsed: varchar("model_used", { length: 255 }),
    providerRequestId: varchar("provider_request_id", { length: 255 }),
    requestBody: jsonb("request_body").notNull(),
    responseBody: jsonb("response_body"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    outputText: text("output_text"),
    finishReason: varchar("finish_reason", { length: 50 }),
    status: varchar("status", { length: 20 }).notNull(),
    error: jsonb("error"),
    costCents: real("cost_cents"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("traces_project_timestamp_idx").on(table.projectId, table.timestamp),
    index("traces_project_session_idx").on(table.projectId, table.sessionId),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export const userProjects = pgTable("user_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("user_projects_user_idx").on(table.userId),
  index("user_projects_project_idx").on(table.projectId),
  uniqueIndex("user_projects_user_project_unique_idx").on(table.userId, table.projectId),
]);

export type UserProject = typeof userProjects.$inferSelect;
export type NewUserProject = typeof userProjects.$inferInsert;

export type Trace = typeof traces.$inferSelect;
export type NewTrace = typeof traces.$inferInsert;
