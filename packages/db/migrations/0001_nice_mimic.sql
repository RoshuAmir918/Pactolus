CREATE TYPE "public"."run_branch_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "run_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"parent_branch_id" uuid,
	"forked_from_step_id" uuid,
	"name" text NOT NULL,
	"status" "run_branch_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "run_steps_run_step_index_unique";--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "parent_step_id" uuid;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "run_branches" ADD CONSTRAINT "run_branches_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_branches" ADD CONSTRAINT "run_branches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_branches" ADD CONSTRAINT "run_branches_parent_branch_id_run_branches_id_fk" FOREIGN KEY ("parent_branch_id") REFERENCES "public"."run_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_branches_run_id_idx" ON "run_branches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_branches_parent_branch_id_idx" ON "run_branches" USING btree ("parent_branch_id");--> statement-breakpoint
CREATE INDEX "run_branches_forked_from_step_id_idx" ON "run_branches" USING btree ("forked_from_step_id");--> statement-breakpoint
CREATE INDEX "run_branches_status_idx" ON "run_branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "run_branches_created_by_user_id_idx" ON "run_branches" USING btree ("created_by_user_id");--> statement-breakpoint
INSERT INTO "run_branches" ("run_id", "name", "created_by_user_id", "created_at", "updated_at")
SELECT r."id", 'main', r."created_by_user_id", now(), now()
FROM "runs" r
WHERE NOT EXISTS (
  SELECT 1
  FROM "run_branches" rb
  WHERE rb."run_id" = r."id"
    AND rb."name" = 'main'
    AND rb."parent_branch_id" IS NULL
);--> statement-breakpoint
UPDATE "run_steps" rs
SET "branch_id" = rb."id"
FROM "run_branches" rb
WHERE rs."branch_id" IS NULL
  AND rb."run_id" = rs."run_id"
  AND rb."name" = 'main'
  AND rb."parent_branch_id" IS NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_branch_id_run_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."run_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_parent_step_id_run_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."run_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_branch_step_index_unique" ON "run_steps" USING btree ("branch_id","step_index");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_branch_idempotency_key_unique" ON "run_steps" USING btree ("branch_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "run_steps_branch_id_idx" ON "run_steps" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "run_steps_parent_step_id_idx" ON "run_steps" USING btree ("parent_step_id");