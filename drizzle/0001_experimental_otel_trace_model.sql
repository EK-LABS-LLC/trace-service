CREATE TABLE `trace_summaries` (
	`trace_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text,
	`root_span_id` text,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`span_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_cents` real DEFAULT 0 NOT NULL,
	`attributes` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trace_summaries_project_started_idx` ON `trace_summaries` (`project_id`,`started_at`);
--> statement-breakpoint
CREATE INDEX `trace_summaries_project_session_idx` ON `trace_summaries` (`project_id`,`session_id`);
--> statement-breakpoint
ALTER TABLE `spans` ADD `trace_id` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `name` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `otel_kind` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `start_time_unix_nano` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `end_time_unix_nano` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `status_code` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `status_message` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `attributes` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `events` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `links` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `resource` text;
--> statement-breakpoint
ALTER TABLE `spans` ADD `scope` text;
--> statement-breakpoint
CREATE INDEX `spans_project_trace_idx` ON `spans` (`project_id`,`trace_id`);
