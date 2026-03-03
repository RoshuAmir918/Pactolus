ALTER TABLE "snapshots" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_created_by_user_id_idx" ON "snapshots" USING btree ("created_by_user_id");