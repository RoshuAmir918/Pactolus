CREATE TYPE "public"."organization_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('firebase', 'auth0', 'cognito', 'google', 'microsoft', 'saml');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('admin', 'manager', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'invited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."snapshot_status" AS ENUM('draft', 'ingesting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."analysis_run_status" AS ENUM('draft', 'running', 'awaiting_confirmation', 'ready', 'failed', 'locked');--> statement-breakpoint
CREATE TYPE "public"."run_branch_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('claim', 'policy');--> statement-breakpoint
CREATE TYPE "public"."snapshot_input_status" AS ENUM('pending', 'ingesting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_step_actor_type" AS ENUM('user', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."run_step_artifact_type" AS ENUM('AI_RAW_RESPONSE', 'MAPPING_VALIDATION_REPORT', 'CANONICALIZATION_SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."ingestion_error_code" AS ENUM('MAPPING_ERROR', 'PARSE_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR');--> statement-breakpoint
CREATE TYPE "public"."context_document_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."context_document_type" AS ENUM('raw_profile', 'canonical_summary', 'benchmark_feature', 'mapping_memory', 'analyst_note', 'model_insight');--> statement-breakpoint
CREATE TYPE "public"."context_scope" AS ENUM('organization', 'client', 'snapshot', 'run_branch', 'global_benchmark');--> statement-breakpoint
CREATE TYPE "public"."context_truth_tier" AS ENUM('tier0', 'tier1', 'tier2', 'tier3');--> statement-breakpoint
CREATE TYPE "public"."context_source_type" AS ENUM('snapshot_input', 'raw_row', 'run_step', 'run_step_artifact', 'canonical_claim', 'canonical_policy', 'external_reference');--> statement-breakpoint
CREATE TYPE "public"."excel_monitored_region_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."excel_monitored_region_type" AS ENUM('input', 'output');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" "auth_provider" NOT NULL,
	"auth_subject_id" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'analyst' NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"accounting_period" text,
	"status" "snapshot_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"parent_run_id" uuid,
	"name" text NOT NULL,
	"status" "analysis_run_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "snapshot_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"file_name" text NOT NULL,
	"file_hash" text,
	"status" "snapshot_input_status" DEFAULT 'pending' NOT NULL,
	"row_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"snapshot_input_id" uuid,
	"branch_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"parent_step_id" uuid,
	"step_type" text NOT NULL,
	"actor_type" "run_step_actor_type" NOT NULL,
	"actor_id" uuid,
	"idempotency_key" text,
	"parameters_json" jsonb NOT NULL,
	"supersedes_step_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_step_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_step_id" uuid NOT NULL,
	"artifact_type" "run_step_artifact_type" NOT NULL,
	"data_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_input_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_json" jsonb NOT NULL,
	"raw_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims_canonical" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_step_id" uuid NOT NULL,
	"raw_row_id" uuid NOT NULL,
	"claim_number" text NOT NULL,
	"accounting_period" text,
	"evaluation_date" date,
	"accident_date" date NOT NULL,
	"total_incurred" numeric(18, 2) NOT NULL,
	"policy_number" text,
	"paid_indemnity" numeric(18, 2),
	"paid_medical" numeric(18, 2),
	"paid_expense" numeric(18, 2),
	"os_indemnity" numeric(18, 2),
	"os_medical" numeric(18, 2),
	"os_expense" numeric(18, 2),
	"line_of_business" text,
	"cedent" text,
	"profit_center" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies_canonical" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_step_id" uuid NOT NULL,
	"raw_row_id" uuid NOT NULL,
	"policy_number" text NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date NOT NULL,
	"insured_name" text,
	"line_of_business" text,
	"attachment_point" numeric(18, 2),
	"gross_premium" numeric(18, 2),
	"risk_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_step_id" uuid NOT NULL,
	"raw_row_id" uuid,
	"code" "ingestion_error_code" NOT NULL,
	"message" text NOT NULL,
	"details_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "excel_monitored_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"sheet_name" text NOT NULL,
	"address" text NOT NULL,
	"region_type" "excel_monitored_region_type" NOT NULL,
	"confidence_percent" integer DEFAULT 0 NOT NULL,
	"user_confirmed" boolean DEFAULT false NOT NULL,
	"status" "excel_monitored_region_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_branches" ADD CONSTRAINT "run_branches_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_branches" ADD CONSTRAINT "run_branches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_branches" ADD CONSTRAINT "run_branches_parent_branch_id_run_branches_id_fk" FOREIGN KEY ("parent_branch_id") REFERENCES "public"."run_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_inputs" ADD CONSTRAINT "snapshot_inputs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_snapshot_input_id_snapshot_inputs_id_fk" FOREIGN KEY ("snapshot_input_id") REFERENCES "public"."snapshot_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_branch_id_run_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."run_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_parent_step_id_run_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."run_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_supersedes_step_id_run_steps_id_fk" FOREIGN KEY ("supersedes_step_id") REFERENCES "public"."run_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step_artifacts" ADD CONSTRAINT "run_step_artifacts_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_rows" ADD CONSTRAINT "raw_rows_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_rows" ADD CONSTRAINT "raw_rows_snapshot_input_id_snapshot_inputs_id_fk" FOREIGN KEY ("snapshot_input_id") REFERENCES "public"."snapshot_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_raw_row_id_raw_rows_id_fk" FOREIGN KEY ("raw_row_id") REFERENCES "public"."raw_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_raw_row_id_raw_rows_id_fk" FOREIGN KEY ("raw_row_id") REFERENCES "public"."raw_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_raw_row_id_raw_rows_id_fk" FOREIGN KEY ("raw_row_id") REFERENCES "public"."raw_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_branch_id_run_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."run_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_source_step_id_run_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."run_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_document_sources" ADD CONSTRAINT "context_document_sources_context_document_id_context_documents_id_fk" FOREIGN KEY ("context_document_id") REFERENCES "public"."context_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excel_monitored_regions" ADD CONSTRAINT "excel_monitored_regions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excel_monitored_regions" ADD CONSTRAINT "excel_monitored_regions_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excel_monitored_regions" ADD CONSTRAINT "excel_monitored_regions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_name_unique" ON "clients" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "clients_org_id_idx" ON "clients" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_subject_unique" ON "users" USING btree ("auth_provider","auth_subject_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_unique" ON "memberships" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "memberships_org_id_idx" ON "memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_org_role_idx" ON "memberships" USING btree ("org_id","role");--> statement-breakpoint
CREATE INDEX "snapshots_org_id_idx" ON "snapshots" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "snapshots_client_id_idx" ON "snapshots" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "snapshots_org_client_period_idx" ON "snapshots" USING btree ("org_id","client_id","accounting_period");--> statement-breakpoint
CREATE INDEX "snapshots_created_by_user_id_idx" ON "snapshots" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "snapshots_status_idx" ON "snapshots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_org_id_idx" ON "runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "runs_snapshot_id_idx" ON "runs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "runs_parent_run_id_idx" ON "runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_created_by_user_id_idx" ON "runs" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "run_branches_run_id_idx" ON "run_branches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_branches_parent_branch_id_idx" ON "run_branches" USING btree ("parent_branch_id");--> statement-breakpoint
CREATE INDEX "run_branches_forked_from_step_id_idx" ON "run_branches" USING btree ("forked_from_step_id");--> statement-breakpoint
CREATE INDEX "run_branches_status_idx" ON "run_branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "run_branches_created_by_user_id_idx" ON "run_branches" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_inputs_snapshot_entity_unique" ON "snapshot_inputs" USING btree ("snapshot_id","entity_type");--> statement-breakpoint
CREATE INDEX "snapshot_inputs_snapshot_id_idx" ON "snapshot_inputs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "snapshot_inputs_status_idx" ON "snapshot_inputs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_branch_step_index_unique" ON "run_steps" USING btree ("branch_id","step_index");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_branch_idempotency_key_unique" ON "run_steps" USING btree ("branch_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "run_steps_run_id_idx" ON "run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_steps_snapshot_input_id_idx" ON "run_steps" USING btree ("snapshot_input_id");--> statement-breakpoint
CREATE INDEX "run_steps_branch_id_idx" ON "run_steps" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "run_steps_parent_step_id_idx" ON "run_steps" USING btree ("parent_step_id");--> statement-breakpoint
CREATE INDEX "run_steps_step_type_idx" ON "run_steps" USING btree ("step_type");--> statement-breakpoint
CREATE INDEX "run_steps_actor_type_idx" ON "run_steps" USING btree ("actor_type");--> statement-breakpoint
CREATE INDEX "run_steps_actor_id_idx" ON "run_steps" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "run_steps_supersedes_step_id_idx" ON "run_steps" USING btree ("supersedes_step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_step_artifacts_step_type_unique" ON "run_step_artifacts" USING btree ("run_step_id","artifact_type");--> statement-breakpoint
CREATE INDEX "run_step_artifacts_run_step_id_idx" ON "run_step_artifacts" USING btree ("run_step_id");--> statement-breakpoint
CREATE INDEX "run_step_artifacts_artifact_type_idx" ON "run_step_artifacts" USING btree ("artifact_type");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_rows_input_row_number_unique" ON "raw_rows" USING btree ("snapshot_input_id","row_number");--> statement-breakpoint
CREATE INDEX "raw_rows_snapshot_id_idx" ON "raw_rows" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "raw_rows_input_id_idx" ON "raw_rows" USING btree ("snapshot_input_id");--> statement-breakpoint
CREATE INDEX "raw_rows_hash_idx" ON "raw_rows" USING btree ("raw_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_canonical_step_raw_row_unique" ON "claims_canonical" USING btree ("run_step_id","raw_row_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_snapshot_id_idx" ON "claims_canonical" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_run_id_idx" ON "claims_canonical" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_run_step_id_idx" ON "claims_canonical" USING btree ("run_step_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_claim_number_idx" ON "claims_canonical" USING btree ("claim_number");--> statement-breakpoint
CREATE UNIQUE INDEX "policies_canonical_step_raw_row_unique" ON "policies_canonical" USING btree ("run_step_id","raw_row_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_snapshot_id_idx" ON "policies_canonical" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_run_id_idx" ON "policies_canonical" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_run_step_id_idx" ON "policies_canonical" USING btree ("run_step_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_policy_number_idx" ON "policies_canonical" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "ingestion_errors_snapshot_id_idx" ON "ingestion_errors" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_run_id_idx" ON "ingestion_errors" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_run_step_id_idx" ON "ingestion_errors" USING btree ("run_step_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_raw_row_id_idx" ON "ingestion_errors" USING btree ("raw_row_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_code_idx" ON "ingestion_errors" USING btree ("code");--> statement-breakpoint
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
CREATE UNIQUE INDEX "excel_monitored_regions_unique" ON "excel_monitored_regions" USING btree ("snapshot_id","sheet_name","address","region_type");--> statement-breakpoint
CREATE INDEX "excel_monitored_regions_org_id_idx" ON "excel_monitored_regions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "excel_monitored_regions_snapshot_id_idx" ON "excel_monitored_regions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "excel_monitored_regions_sheet_name_idx" ON "excel_monitored_regions" USING btree ("sheet_name");--> statement-breakpoint
CREATE INDEX "excel_monitored_regions_region_type_idx" ON "excel_monitored_regions" USING btree ("region_type");--> statement-breakpoint
CREATE INDEX "excel_monitored_regions_status_idx" ON "excel_monitored_regions" USING btree ("status");