import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "../organizations";
import { snapshots } from "../snapshots";
import { anthropicFiles } from "./anthropicFiles";
import { documents } from "./documents";

export const snapshotAnthropicFileStatusEnum = pgEnum("snapshot_anthropic_file_status", [
  "active",
  "deleted",
]);

export const snapshotAnthropicFiles = pgTable(
  "snapshot_anthropic_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    anthropicFileRefId: uuid("anthropic_file_ref_id")
      .notNull()
      .references(() => anthropicFiles.id, { onDelete: "cascade" }),
    status: snapshotAnthropicFileStatusEnum("status").notNull().default("active"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("snapshot_anthropic_files_unique").on(
      table.snapshotId,
      table.documentId,
      table.anthropicFileRefId,
    ),
    index("snapshot_anthropic_files_org_id_idx").on(table.orgId),
    index("snapshot_anthropic_files_snapshot_id_idx").on(table.snapshotId),
    index("snapshot_anthropic_files_document_id_idx").on(table.documentId),
    index("snapshot_anthropic_files_file_ref_id_idx").on(table.anthropicFileRefId),
    index("snapshot_anthropic_files_status_idx").on(table.status),
  ],
);

export type InsertSnapshotAnthropicFile = typeof snapshotAnthropicFiles.$inferInsert;
export type SelectSnapshotAnthropicFile = typeof snapshotAnthropicFiles.$inferSelect;
