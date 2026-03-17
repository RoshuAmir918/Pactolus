CREATE TYPE "public"."document_ai_classification" AS ENUM('claims', 'policies', 'loss_triangles', 'workbook_tool', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."document_process_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('claims', 'policies', 'loss_triangles', 'workbook_tool', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_sheet_ai_classification" AS ENUM('claims_like', 'policies_like', 'triangle_like', 'tool_sheet', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."document_sheet_type" AS ENUM('claims_like', 'policies_like', 'triangle_like', 'tool_sheet', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."triangle_extraction_method" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."triangle_type" AS ENUM('paid', 'incurred', 'reported', 'ultimate', 'unknown');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_object_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"document_type" "document_type" DEFAULT 'other' NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_extension" text,
	"s3_key" text NOT NULL,
	"file_hash" text,
	"file_size_bytes" bigint NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ai_classification" "document_ai_classification" DEFAULT 'unknown' NOT NULL,
	"ai_confidence" numeric(5, 4),
	"search_text" text,
	"profile_status" "document_process_status" DEFAULT 'pending' NOT NULL,
	"ai_status" "document_process_status" DEFAULT 'pending' NOT NULL,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"sheet_name" text NOT NULL,
	"sheet_index" integer NOT NULL,
	"sheet_type" "document_sheet_type" DEFAULT 'unknown' NOT NULL,
	"used_range_json" jsonb,
	"headers_json" jsonb,
	"sample_rows_json" jsonb,
	"row_count_estimate" integer,
	"detected_tables_json" jsonb,
	"ai_classification" "document_sheet_ai_classification" DEFAULT 'unknown' NOT NULL,
	"ai_confidence" numeric(5, 4),
	"search_text" text,
	"profile_status" "document_process_status" DEFAULT 'pending' NOT NULL,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_triangles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"sheet_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"title" text,
	"segment_label" text,
	"triangle_type" "triangle_type" DEFAULT 'unknown' NOT NULL,
	"row_start" integer,
	"row_end" integer,
	"col_start" integer,
	"col_end" integer,
	"header_labels_json" jsonb,
	"normalized_triangle_json" jsonb NOT NULL,
	"confidence" numeric(5, 4),
	"extraction_method" "triangle_extraction_method" DEFAULT 'ai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_object_id_file_objects_id_fk" FOREIGN KEY ("file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sheets" ADD CONSTRAINT "document_sheets_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sheets" ADD CONSTRAINT "document_sheets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sheets" ADD CONSTRAINT "document_sheets_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_triangles" ADD CONSTRAINT "document_triangles_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_triangles" ADD CONSTRAINT "document_triangles_sheet_id_document_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."document_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_triangles" ADD CONSTRAINT "document_triangles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_triangles" ADD CONSTRAINT "document_triangles_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_file_object_id_unique" ON "documents" USING btree ("file_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_s3_key_unique" ON "documents" USING btree ("s3_key");--> statement-breakpoint
CREATE INDEX "documents_org_id_idx" ON "documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "documents_snapshot_id_idx" ON "documents" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "documents_document_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "documents_profile_status_idx" ON "documents" USING btree ("profile_status");--> statement-breakpoint
CREATE INDEX "documents_ai_status_idx" ON "documents" USING btree ("ai_status");--> statement-breakpoint
CREATE INDEX "documents_uploaded_by_user_id_idx" ON "documents" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_sheets_document_sheet_index_unique" ON "document_sheets" USING btree ("document_id","sheet_index");--> statement-breakpoint
CREATE INDEX "document_sheets_document_id_idx" ON "document_sheets" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_sheets_org_id_idx" ON "document_sheets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "document_sheets_snapshot_id_idx" ON "document_sheets" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "document_sheets_sheet_type_idx" ON "document_sheets" USING btree ("sheet_type");--> statement-breakpoint
CREATE INDEX "document_sheets_profile_status_idx" ON "document_sheets" USING btree ("profile_status");--> statement-breakpoint
CREATE INDEX "document_triangles_document_id_idx" ON "document_triangles" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_triangles_sheet_id_idx" ON "document_triangles" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "document_triangles_org_id_idx" ON "document_triangles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "document_triangles_snapshot_id_idx" ON "document_triangles" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "document_triangles_triangle_type_idx" ON "document_triangles" USING btree ("triangle_type");--> statement-breakpoint
CREATE INDEX "document_triangles_extraction_method_idx" ON "document_triangles" USING btree ("extraction_method");