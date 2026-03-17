import {
  index,
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

export const documentInsightTypeEnum = pgEnum("document_insight_type", [
  "segment_manifest",
  "aggregate_stats",
  "quality_flags",
  "contract_terms",
  "narrative",
  "other",
]);

export const documentInsights = pgTable(
  "document_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sheetId: uuid("sheet_id").references(() => documentSheets.id, { onDelete: "set null" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    insightType: documentInsightTypeEnum("insight_type").notNull(),
    title: text("title"),
    payloadJson: jsonb("payload_json").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    source: text("source").notNull().default("ai"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("document_insights_document_id_idx").on(table.documentId),
    index("document_insights_sheet_id_idx").on(table.sheetId),
    index("document_insights_org_id_idx").on(table.orgId),
    index("document_insights_snapshot_id_idx").on(table.snapshotId),
    index("document_insights_type_idx").on(table.insightType),
  ],
);

export type InsertDocumentInsight = typeof documentInsights.$inferInsert;
export type SelectDocumentInsight = typeof documentInsights.$inferSelect;
