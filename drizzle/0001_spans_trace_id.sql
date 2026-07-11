ALTER TABLE `spans` ADD `trace_id` text;--> statement-breakpoint
CREATE INDEX `spans_project_trace_idx` ON `spans` (`project_id`,`trace_id`);