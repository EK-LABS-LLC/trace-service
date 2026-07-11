PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_spans` (
	`span_id` text NOT NULL,
	`trace_id` text,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`parent_span_id` text,
	`timestamp` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`duration_ms` integer,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`tool_use_id` text,
	`tool_name` text,
	`tool_input` text,
	`tool_response` text,
	`error` text,
	`is_interrupt` integer,
	`cwd` text,
	`model` text,
	`agent_name` text,
	`provider` text,
	`model_used` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_cents` real,
	`finish_reason` text,
	`output_text` text,
	`provider_request_id` text,
	`metadata` text,
	PRIMARY KEY(`project_id`, `span_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_spans`("span_id", "trace_id", "project_id", "session_id", "parent_span_id", "timestamp", "duration_ms", "source", "kind", "event_type", "status", "tool_use_id", "tool_name", "tool_input", "tool_response", "error", "is_interrupt", "cwd", "model", "agent_name", "provider", "model_used", "input_tokens", "output_tokens", "cost_cents", "finish_reason", "output_text", "provider_request_id", "metadata") SELECT "span_id", "trace_id", "project_id", "session_id", "parent_span_id", "timestamp", "duration_ms", "source", "kind", "event_type", "status", "tool_use_id", "tool_name", "tool_input", "tool_response", "error", "is_interrupt", "cwd", "model", "agent_name", NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, "metadata" FROM `spans`;--> statement-breakpoint
DROP TABLE `spans`;--> statement-breakpoint
ALTER TABLE `__new_spans` RENAME TO `spans`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `spans_project_timestamp_idx` ON `spans` (`project_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `spans_project_trace_idx` ON `spans` (`project_id`,`trace_id`);--> statement-breakpoint
CREATE INDEX `spans_project_session_idx` ON `spans` (`project_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `spans_project_kind_idx` ON `spans` (`project_id`,`kind`);