CREATE TABLE "spans" (
	"span_id" text PRIMARY KEY NOT NULL,
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
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "spans_project_timestamp_idx" ON "spans" USING btree ("project_id","timestamp");
--> statement-breakpoint
CREATE INDEX "spans_project_session_idx" ON "spans" USING btree ("project_id","session_id");
--> statement-breakpoint
CREATE INDEX "spans_project_kind_idx" ON "spans" USING btree ("project_id","kind");
