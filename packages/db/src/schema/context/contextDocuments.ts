import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clients } from "../clients";
import { organizations } from "../organizations";
import { runBranches } from "../operations/runBranches";
import { runOperations } from "../operations/runOperations";
import { runs } from "../operations/runs";
import { snapshots } from "../snapshots";
import { users } from "../users";

export const contextScopeEnum = pgEnum("context_scope", [
  "organization",
  "client",
  "snapshot",
  "run_branch",
  "global_benchmark",
]);

export const contextDocumentTypeEnum = pgEnum("context_document_type", [
  "raw_profile",
  "canonical_summary",
  "benchmark_feature",
  "mapping_memory",
  "analyst_note",
  "model_insight",
]);

export const contextTruthTierEnum = pgEnum("context_truth_tier", [
  "tier0",
  "tier1",
  "tier2",
  "tier3",
]);

export const contextDocumentStatusEnum = pgEnum("context_document_status", [
  "active",
  "archived",
]);

export const contextDocuments = pgTable(
  "context_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    snapshotId: uuid("snapshot_id").references(() => snapshots.id, { onDelete: "set null" }),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
    branchId: uuid("branch_id").references(() => runBranches.id, { onDelete: "set null" }),
    sourceStepId: uuid("source_step_id").references(() => runOperations.id, {
      onDelete: "set null",
    }),
    scopeType: contextScopeEnum("scope_type").notNull(),
    docType: contextDocumentTypeEnum("doc_type").notNull(),
    truthTier: contextTruthTierEnum("truth_tier").notNull().default("tier2"),
    title: text("title").notNull(),
    summaryText: text("summary_text"),
    searchableText: text("searchable_text"),
    contentJson: jsonb("content_json").notNull(),
    keywordsJson: jsonb("keywords_json"),
    provenanceJson: jsonb("provenance_json"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    status: contextDocumentStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("context_documents_org_id_idx").on(table.orgId),
    index("context_documents_client_id_idx").on(table.clientId),
    index("context_documents_snapshot_id_idx").on(table.snapshotId),
    index("context_documents_run_id_idx").on(table.runId),
    index("context_documents_branch_id_idx").on(table.branchId),
    index("context_documents_source_step_id_idx").on(table.sourceStepId),
    index("context_documents_scope_type_idx").on(table.scopeType),
    index("context_documents_doc_type_idx").on(table.docType),
    index("context_documents_truth_tier_idx").on(table.truthTier),
    index("context_documents_status_idx").on(table.status),
  ],
);

export type InsertContextDocument = typeof contextDocuments.$inferInsert;
export type SelectContextDocument = typeof contextDocuments.$inferSelect;
