import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "../organizations";
import { snapshots } from "../snapshots";
import { documentProcessStatusEnum, documents } from "./documents";

export const documentSheetTypeEnum = pgEnum("document_sheet_type", [
  "claims_like",
  "policies_like",
  "triangle_like",
  "tool_sheet",
  "other",
  "unknown",
]);

export const documentSheetAiClassificationEnum = pgEnum("document_sheet_ai_classification", [
  "claims_like",
  "policies_like",
  "triangle_like",
  "tool_sheet",
  "other",
  "unknown",
]);

export const documentSheets = pgTable(
  "document_sheets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    sheetName: text("sheet_name").notNull(),
    sheetIndex: integer("sheet_index").notNull(),
    sheetType: documentSheetTypeEnum("sheet_type").notNull().default("unknown"),
    usedRangeJson: jsonb("used_range_json"),
    headersJson: jsonb("headers_json"),
    sampleRowsJson: jsonb("sample_rows_json"),
    rowCountEstimate: integer("row_count_estimate"),
    detectedTablesJson: jsonb("detected_tables_json"),
    sheetAboutJson: jsonb("sheet_about_json"),
    aiClassification: documentSheetAiClassificationEnum("ai_classification")
      .notNull()
      .default("unknown"),
    aiConfidence: numeric("ai_confidence", { precision: 5, scale: 4 }),
    searchText: text("search_text"),
    profileStatus: documentProcessStatusEnum("profile_status").notNull().default("pending"),
    errorText: text("error_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("document_sheets_document_sheet_index_unique").on(
      table.documentId,
      table.sheetIndex,
    ),
    index("document_sheets_document_id_idx").on(table.documentId),
    index("document_sheets_org_id_idx").on(table.orgId),
    index("document_sheets_snapshot_id_idx").on(table.snapshotId),
    index("document_sheets_sheet_type_idx").on(table.sheetType),
    index("document_sheets_profile_status_idx").on(table.profileStatus),
  ],
);

export type InsertDocumentSheet = typeof documentSheets.$inferInsert;
export type SelectDocumentSheet = typeof documentSheets.$inferSelect;
