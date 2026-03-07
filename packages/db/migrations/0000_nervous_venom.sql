CREATE TYPE "public"."organization_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('firebase', 'auth0', 'cognito', 'google', 'microsoft', 'saml');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('admin', 'manager', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'invited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."snapshot_status" AS ENUM('draft', 'ingesting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."analysis_run_status" AS ENUM('draft', 'running', 'awaiting_confirmation', 'ready', 'failed', 'locked');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('claim', 'policy');--> statement-breakpoint
CREATE TYPE "public"."snapshot_input_status" AS ENUM('pending', 'ingesting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_step_actor_type" AS ENUM('user', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."run_step_type" AS ENUM('UPLOAD_DATASET', 'APPLY_MAPPING_TEMPLATE', 'SUGGESTED_MAPPING', 'ACCEPTED_MAPPING', 'REJECTED_MAPPING', 'CANONICALIZE_CLAIMS', 'CANONICALIZE_POLICIES', 'SET_FILTERS', 'SET_GROUPING', 'SET_METRIC_DEFINITION', 'RUN_RECONCILIATION', 'RUN_AGGREGATION', 'SET_OUTLIER_THRESHOLD', 'LOCK_RUN');--> statement-breakpoint
CREATE TYPE "public"."run_step_artifact_type" AS ENUM('AI_RAW_RESPONSE', 'MAPPING_VALIDATION_REPORT', 'CANONICALIZATION_SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."ingestion_error_code" AS ENUM('MAPPING_ERROR', 'PARSE_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
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
	"step_index" integer NOT NULL,
	"step_type" "run_step_type" NOT NULL,
	"actor_type" "run_step_actor_type" NOT NULL,
	"actor_id" uuid,
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
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_inputs" ADD CONSTRAINT "snapshot_inputs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_snapshot_input_id_snapshot_inputs_id_fk" FOREIGN KEY ("snapshot_input_id") REFERENCES "public"."snapshot_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_subject_unique" ON "users" USING btree ("auth_provider","auth_subject_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_unique" ON "memberships" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "memberships_org_id_idx" ON "memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_org_role_idx" ON "memberships" USING btree ("org_id","role");--> statement-breakpoint
CREATE INDEX "snapshots_org_id_idx" ON "snapshots" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "snapshots_created_by_user_id_idx" ON "snapshots" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "snapshots_status_idx" ON "snapshots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_org_id_idx" ON "runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "runs_snapshot_id_idx" ON "runs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "runs_parent_run_id_idx" ON "runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_created_by_user_id_idx" ON "runs" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_inputs_snapshot_entity_unique" ON "snapshot_inputs" USING btree ("snapshot_id","entity_type");--> statement-breakpoint
CREATE INDEX "snapshot_inputs_snapshot_id_idx" ON "snapshot_inputs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "snapshot_inputs_status_idx" ON "snapshot_inputs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_run_step_index_unique" ON "run_steps" USING btree ("run_id","step_index");--> statement-breakpoint
CREATE INDEX "run_steps_run_id_idx" ON "run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_steps_snapshot_input_id_idx" ON "run_steps" USING btree ("snapshot_input_id");--> statement-breakpoint
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
CREATE INDEX "ingestion_errors_code_idx" ON "ingestion_errors" USING btree ("code");