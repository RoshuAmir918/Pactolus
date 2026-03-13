import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contextDocuments } from "./contextDocuments";

export const contextSourceTypeEnum = pgEnum("context_source_type", [
  "snapshot_input",
  "raw_row",
  "run_step",
  "run_step_artifact",
  "canonical_claim",
  "canonical_policy",
  "external_reference",
]);

export const contextDocumentSources = pgTable(
  "context_document_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contextDocumentId: uuid("context_document_id")
      .notNull()
      .references(() => contextDocuments.id, { onDelete: "cascade" }),
    sourceType: contextSourceTypeEnum("source_type").notNull(),
    sourceRefId: text("source_ref_id").notNull(),
    sourceMetadataJson: jsonb("source_metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("context_document_sources_doc_source_unique").on(
      table.contextDocumentId,
      table.sourceType,
      table.sourceRefId,
    ),
    index("context_document_sources_doc_id_idx").on(table.contextDocumentId),
    index("context_document_sources_source_type_idx").on(table.sourceType),
    index("context_document_sources_source_ref_id_idx").on(table.sourceRefId),
  ],
);

export type InsertContextDocumentSource = typeof contextDocumentSources.$inferInsert;
export type SelectContextDocumentSource = typeof contextDocumentSources.$inferSelect;
