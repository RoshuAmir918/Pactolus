CREATE TYPE "public"."file_object_status" AS ENUM('pending', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TABLE "file_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid,
	"snapshot_id" uuid,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"status" "file_object_status" DEFAULT 'ready' NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_objects_bucket_object_key_unique" ON "file_objects" USING btree ("bucket","object_key");--> statement-breakpoint
CREATE INDEX "file_objects_org_id_idx" ON "file_objects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "file_objects_snapshot_id_idx" ON "file_objects" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "file_objects_client_id_idx" ON "file_objects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "file_objects_status_idx" ON "file_objects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "file_objects_uploaded_by_user_id_idx" ON "file_objects" USING btree ("uploaded_by_user_id");