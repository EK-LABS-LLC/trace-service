DROP INDEX "traces_project_id_idx";--> statement-breakpoint
DROP INDEX "traces_timestamp_idx";--> statement-breakpoint
CREATE INDEX "traces_project_timestamp_idx" ON "traces" USING btree ("project_id","timestamp");