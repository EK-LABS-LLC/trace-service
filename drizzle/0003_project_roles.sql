UPDATE "user_projects"
SET "role" = 'admin'
WHERE "role" = 'owner';
--> statement-breakpoint
UPDATE "user_projects"
SET "role" = 'user'
WHERE "role" NOT IN ('admin', 'user');
--> statement-breakpoint
ALTER TABLE "user_projects" ALTER COLUMN "role" SET DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "user_projects"
ADD CONSTRAINT "user_projects_role_check" CHECK ("role" IN ('admin', 'user'));

