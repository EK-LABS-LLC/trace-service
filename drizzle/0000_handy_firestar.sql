CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`name` text DEFAULT 'Default Key' NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`metadata` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spans` (
	`span_id` text PRIMARY KEY NOT NULL,
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
	`metadata` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spans_project_timestamp_idx` ON `spans` (`project_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `spans_project_session_idx` ON `spans` (`project_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `spans_project_kind_idx` ON `spans` (`project_id`,`kind`);--> statement-breakpoint
CREATE TABLE `traces` (
	`trace_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text,
	`timestamp` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`latency_ms` integer NOT NULL,
	`provider` text NOT NULL,
	`model_requested` text NOT NULL,
	`model_used` text,
	`provider_request_id` text,
	`request_body` text NOT NULL,
	`response_body` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`output_text` text,
	`finish_reason` text,
	`status` text NOT NULL,
	`error` text,
	`cost_cents` real,
	`metadata` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `traces_project_timestamp_idx` ON `traces` (`project_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `traces_project_session_idx` ON `traces` (`project_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `user_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_projects_user_idx` ON `user_projects` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_projects_project_idx` ON `user_projects` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_projects_user_project_unique_idx` ON `user_projects` (`user_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_session_token_unique` ON `auth_session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
