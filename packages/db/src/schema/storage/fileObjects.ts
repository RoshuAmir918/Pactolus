import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clients } from "../clients";
import { organizations } from "../organizations";
import { snapshots } from "../snapshots";
import { users } from "../users";

export const fileObjectStatusEnum = pgEnum("file_object_status", [
  "pending",
  "ready",
  "failed",
  "deleted",
]);

export const fileObjects = pgTable(
  "file_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    snapshotId: uuid("snapshot_id").references(() => snapshots.id, { onDelete: "set null" }),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    status: fileObjectStatusEnum("status").notNull().default("ready"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("file_objects_bucket_object_key_unique").on(table.bucket, table.objectKey),
    index("file_objects_org_id_idx").on(table.orgId),
    index("file_objects_snapshot_id_idx").on(table.snapshotId),
    index("file_objects_client_id_idx").on(table.clientId),
    index("file_objects_status_idx").on(table.status),
    index("file_objects_uploaded_by_user_id_idx").on(table.uploadedByUserId),
  ],
);

export type InsertFileObject = typeof fileObjects.$inferInsert;
export type SelectFileObject = typeof fileObjects.$inferSelect;
