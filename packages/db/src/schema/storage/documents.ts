import {
  bigint,
  index,
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
import { users } from "../users";
import { fileObjects } from "./fileObjects";

export const documentTypeEnum = pgEnum("document_type", [
  "claims",
  "policies",
  "loss_triangles",
  "workbook_tool",
  "other",
]);

export const documentAiClassificationEnum = pgEnum("document_ai_classification", [
  "claims",
  "policies",
  "loss_triangles",
  "workbook_tool",
  "other",
  "unknown",
]);

export const documentProcessStatusEnum = pgEnum("document_process_status", [
  "pending",
  "completed",
  "failed",
]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileObjectId: uuid("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    documentType: documentTypeEnum("document_type").notNull().default("other"),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileExtension: text("file_extension"),
    s3Key: text("s3_key").notNull(),
    fileHash: text("file_hash"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    aiClassification: documentAiClassificationEnum("ai_classification")
      .notNull()
      .default("unknown"),
    aiConfidence: numeric("ai_confidence", { precision: 5, scale: 4 }),
    searchText: text("search_text"),
    profileStatus: documentProcessStatusEnum("profile_status").notNull().default("pending"),
    aiStatus: documentProcessStatusEnum("ai_status").notNull().default("pending"),
    errorText: text("error_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("documents_file_object_id_unique").on(table.fileObjectId),
    uniqueIndex("documents_s3_key_unique").on(table.s3Key),
    index("documents_org_id_idx").on(table.orgId),
    index("documents_snapshot_id_idx").on(table.snapshotId),
    index("documents_document_type_idx").on(table.documentType),
    index("documents_profile_status_idx").on(table.profileStatus),
    index("documents_ai_status_idx").on(table.aiStatus),
    index("documents_uploaded_by_user_id_idx").on(table.uploadedByUserId),
  ],
);

export type InsertDocument = typeof documents.$inferInsert;
export type SelectDocument = typeof documents.$inferSelect;
