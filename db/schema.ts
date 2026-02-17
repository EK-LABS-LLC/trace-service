import {
  sqliteTable,
  text,
  integer,
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
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
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
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
    timestamp: integer("timestamp", { mode: "timestamp" })
      .defaultNow()
      .notNull(),
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
    costCents: integer("cost_cents"), // Store as integer (cents * 100 for precision)
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
    createdAt: integer("created_at", { mode: "timestamp" })
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

export type Trace = typeof traces.$inferSelect;
export type NewTrace = typeof traces.$inferInsert;

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  status: text("status").notNull(),
  currentPeriodStart: integer("current_period_start", { mode: "timestamp" }),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
