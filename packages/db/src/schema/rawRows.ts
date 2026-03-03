import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { snapshots } from "./snapshots";
import { snapshotInputs } from "./snapshotInputs";

export const rawRows = pgTable(
  "raw_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    snapshotInputId: uuid("snapshot_input_id")
      .notNull()
      .references(() => snapshotInputs.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    rawHash: text("raw_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("raw_rows_input_row_number_unique").on(
      table.snapshotInputId,
      table.rowNumber,
    ),
    index("raw_rows_snapshot_id_idx").on(table.snapshotId),
    index("raw_rows_input_id_idx").on(table.snapshotInputId),
    index("raw_rows_hash_idx").on(table.rawHash),
  ],
);

export type InsertRawRow = typeof rawRows.$inferInsert;
export type SelectRawRow = typeof rawRows.$inferSelect;
