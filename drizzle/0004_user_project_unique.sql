DELETE FROM "user_projects" up
WHERE up.id IN (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY "user_id", "project_id"
             ORDER BY "created_at" ASC, id ASC
           ) AS rn
    FROM "user_projects"
  ) ranked
  WHERE ranked.rn > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_projects_user_project_unique_idx"
ON "user_projects" USING btree ("user_id", "project_id");

