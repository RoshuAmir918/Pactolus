ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "created_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;