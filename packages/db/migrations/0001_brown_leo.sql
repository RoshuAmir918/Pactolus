CREATE TYPE "public"."snapshot_status" AS ENUM('draft', 'ingesting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('claim', 'policy');--> statement-breakpoint
CREATE TYPE "public"."snapshot_input_status" AS ENUM('pending', 'ingesting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mapping_run_status" AS ENUM('pending', 'validated', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_error_code" AS ENUM('MAPPING_ERROR', 'PARSE_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR');--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"label" text NOT NULL,
	"accounting_period" text,
	"status" "snapshot_status" DEFAULT 'draft' NOT NULL,
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
CREATE TABLE "mapping_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_input_id" uuid NOT NULL,
	"ai_proposal_json" jsonb,
	"validated_mapping_json" jsonb,
	"validation_report_json" jsonb,
	"status" "mapping_run_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims_canonical" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"mapping_run_id" uuid NOT NULL,
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
	"mapping_run_id" uuid NOT NULL,
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
	"mapping_run_id" uuid NOT NULL,
	"raw_row_id" uuid,
	"code" "ingestion_error_code" NOT NULL,
	"message" text NOT NULL,
	"details_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_inputs" ADD CONSTRAINT "snapshot_inputs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_rows" ADD CONSTRAINT "raw_rows_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_rows" ADD CONSTRAINT "raw_rows_snapshot_input_id_snapshot_inputs_id_fk" FOREIGN KEY ("snapshot_input_id") REFERENCES "public"."snapshot_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_runs" ADD CONSTRAINT "mapping_runs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_runs" ADD CONSTRAINT "mapping_runs_snapshot_input_id_snapshot_inputs_id_fk" FOREIGN KEY ("snapshot_input_id") REFERENCES "public"."snapshot_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_mapping_run_id_mapping_runs_id_fk" FOREIGN KEY ("mapping_run_id") REFERENCES "public"."mapping_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims_canonical" ADD CONSTRAINT "claims_canonical_raw_row_id_raw_rows_id_fk" FOREIGN KEY ("raw_row_id") REFERENCES "public"."raw_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_mapping_run_id_mapping_runs_id_fk" FOREIGN KEY ("mapping_run_id") REFERENCES "public"."mapping_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies_canonical" ADD CONSTRAINT "policies_canonical_raw_row_id_raw_rows_id_fk" FOREIGN KEY ("raw_row_id") REFERENCES "public"."raw_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_mapping_run_id_mapping_runs_id_fk" FOREIGN KEY ("mapping_run_id") REFERENCES "public"."mapping_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_raw_row_id_raw_rows_id_fk" FOREIGN KEY ("raw_row_id") REFERENCES "public"."raw_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_org_id_idx" ON "snapshots" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "snapshots_status_idx" ON "snapshots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_inputs_snapshot_entity_unique" ON "snapshot_inputs" USING btree ("snapshot_id","entity_type");--> statement-breakpoint
CREATE INDEX "snapshot_inputs_snapshot_id_idx" ON "snapshot_inputs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "snapshot_inputs_status_idx" ON "snapshot_inputs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_rows_input_row_number_unique" ON "raw_rows" USING btree ("snapshot_input_id","row_number");--> statement-breakpoint
CREATE INDEX "raw_rows_snapshot_id_idx" ON "raw_rows" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "raw_rows_input_id_idx" ON "raw_rows" USING btree ("snapshot_input_id");--> statement-breakpoint
CREATE INDEX "raw_rows_hash_idx" ON "raw_rows" USING btree ("raw_hash");--> statement-breakpoint
CREATE INDEX "mapping_runs_snapshot_id_idx" ON "mapping_runs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "mapping_runs_input_id_idx" ON "mapping_runs" USING btree ("snapshot_input_id");--> statement-breakpoint
CREATE INDEX "mapping_runs_status_idx" ON "mapping_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_canonical_run_raw_row_unique" ON "claims_canonical" USING btree ("mapping_run_id","raw_row_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_snapshot_id_idx" ON "claims_canonical" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_mapping_run_id_idx" ON "claims_canonical" USING btree ("mapping_run_id");--> statement-breakpoint
CREATE INDEX "claims_canonical_claim_number_idx" ON "claims_canonical" USING btree ("claim_number");--> statement-breakpoint
CREATE UNIQUE INDEX "policies_canonical_run_raw_row_unique" ON "policies_canonical" USING btree ("mapping_run_id","raw_row_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_snapshot_id_idx" ON "policies_canonical" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_mapping_run_id_idx" ON "policies_canonical" USING btree ("mapping_run_id");--> statement-breakpoint
CREATE INDEX "policies_canonical_policy_number_idx" ON "policies_canonical" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "ingestion_errors_snapshot_id_idx" ON "ingestion_errors" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_mapping_run_id_idx" ON "ingestion_errors" USING btree ("mapping_run_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_raw_row_id_idx" ON "ingestion_errors" USING btree ("raw_row_id");--> statement-breakpoint
CREATE INDEX "ingestion_errors_code_idx" ON "ingestion_errors" USING btree ("code");