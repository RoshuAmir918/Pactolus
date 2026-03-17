import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "../organizations";
import { snapshots } from "../snapshots";
import { documentSheets } from "./documentSheets";
import { documents } from "./documents";

export const triangleTypeEnum = pgEnum("triangle_type", [
  "paid",
  "incurred",
  "reported",
  "ultimate",
  "unknown",
]);

export const triangleExtractionMethodEnum = pgEnum("triangle_extraction_method", [
  "ai",
  "manual",
]);

export const documentTriangles = pgTable(
  "document_triangles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => documentSheets.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    title: text("title"),
    segmentLabel: text("segment_label"),
    triangleType: triangleTypeEnum("triangle_type").notNull().default("unknown"),
    rowStart: integer("row_start"),
    rowEnd: integer("row_end"),
    colStart: integer("col_start"),
    colEnd: integer("col_end"),
    headerLabelsJson: jsonb("header_labels_json"),
    normalizedTriangleJson: jsonb("normalized_triangle_json").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    extractionMethod: triangleExtractionMethodEnum("extraction_method")
      .notNull()
      .default("ai"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("document_triangles_document_id_idx").on(table.documentId),
    index("document_triangles_sheet_id_idx").on(table.sheetId),
    index("document_triangles_org_id_idx").on(table.orgId),
    index("document_triangles_snapshot_id_idx").on(table.snapshotId),
    index("document_triangles_triangle_type_idx").on(table.triangleType),
    index("document_triangles_extraction_method_idx").on(table.extractionMethod),
  ],
);

export type InsertDocumentTriangle = typeof documentTriangles.$inferInsert;
export type SelectDocumentTriangle = typeof documentTriangles.$inferSelect;
