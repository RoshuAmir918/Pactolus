CREATE TYPE "public"."client_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."context_document_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."context_document_type" AS ENUM('raw_profile', 'canonical_summary', 'benchmark_feature', 'mapping_memory', 'analyst_note', 'model_insight');--> statement-breakpoint
CREATE TYPE "public"."context_scope" AS ENUM('organization', 'client', 'snapshot', 'run_branch', 'global_benchmark');--> statement-breakpoint
CREATE TYPE "public"."context_truth_tier" AS ENUM('tier0', 'tier1', 'tier2', 'tier3');--> statement-breakpoint
CREATE TYPE "public"."context_source_type" AS ENUM('snapshot_input', 'raw_row', 'run_step', 'run_step_artifact', 'canonical_claim', 'canonical_policy', 'external_reference');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"external_key" text,
	"metadata_json" jsonb,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid,
	"snapshot_id" uuid,
	"run_id" uuid,
	"branch_id" uuid,
	"source_step_id" uuid,
	"scope_type" "context_scope" NOT NULL,
	"doc_type" "context_document_type" NOT NULL,
	"truth_tier" "context_truth_tier" DEFAULT 'tier2' NOT NULL,
	"title" text NOT NULL,
	"summary_text" text,
	"searchable_text" text,
	"content_json" jsonb NOT NULL,
	"keywords_json" jsonb,
	"provenance_json" jsonb,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"status" "context_document_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_document_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_document_id" uuid NOT NULL,
	"source_type" "context_source_type" NOT NULL,
	"source_ref_id" text NOT NULL,
	"source_metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_branch_id_run_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."run_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_source_step_id_run_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."run_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_document_sources" ADD CONSTRAINT "context_document_sources_context_document_id_context_documents_id_fk" FOREIGN KEY ("context_document_id") REFERENCES "public"."context_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_name_unique" ON "clients" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "clients_org_id_idx" ON "clients" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_external_key_idx" ON "clients" USING btree ("external_key");--> statement-breakpoint
CREATE INDEX "context_documents_org_id_idx" ON "context_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "context_documents_client_id_idx" ON "context_documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "context_documents_snapshot_id_idx" ON "context_documents" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "context_documents_run_id_idx" ON "context_documents" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "context_documents_branch_id_idx" ON "context_documents" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "context_documents_source_step_id_idx" ON "context_documents" USING btree ("source_step_id");--> statement-breakpoint
CREATE INDEX "context_documents_scope_type_idx" ON "context_documents" USING btree ("scope_type");--> statement-breakpoint
CREATE INDEX "context_documents_doc_type_idx" ON "context_documents" USING btree ("doc_type");--> statement-breakpoint
CREATE INDEX "context_documents_truth_tier_idx" ON "context_documents" USING btree ("truth_tier");--> statement-breakpoint
CREATE INDEX "context_documents_status_idx" ON "context_documents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "context_document_sources_doc_source_unique" ON "context_document_sources" USING btree ("context_document_id","source_type","source_ref_id");--> statement-breakpoint
CREATE INDEX "context_document_sources_doc_id_idx" ON "context_document_sources" USING btree ("context_document_id");--> statement-breakpoint
CREATE INDEX "context_document_sources_source_type_idx" ON "context_document_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "context_document_sources_source_ref_id_idx" ON "context_document_sources" USING btree ("source_ref_id");--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_client_id_idx" ON "snapshots" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "snapshots_org_client_period_idx" ON "snapshots" USING btree ("org_id","client_id","accounting_period");