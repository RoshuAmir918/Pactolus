import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { snapshots } from "./snapshots";

export const entityTypeEnum = pgEnum("entity_type", ["claim", "policy"]);

export const snapshotInputStatusEnum = pgEnum("snapshot_input_status", [
  "pending",
  "ingesting",
  "ready",
  "failed",
]);

export const snapshotInputs = pgTable(
  "snapshot_inputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    fileName: text("file_name").notNull(),
    fileHash: text("file_hash"),
    status: snapshotInputStatusEnum("status").notNull().default("pending"),
    rowCount: integer("row_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("snapshot_inputs_snapshot_entity_unique").on(
      table.snapshotId,
      table.entityType,
    ),
    index("snapshot_inputs_snapshot_id_idx").on(table.snapshotId),
    index("snapshot_inputs_status_idx").on(table.status),
  ],
);

export type InsertSnapshotInput = typeof snapshotInputs.$inferInsert;
export type SelectSnapshotInput = typeof snapshotInputs.$inferSelect;
