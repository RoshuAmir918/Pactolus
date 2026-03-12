import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { rawRows } from "./rawRows";
import { runOperations } from "./operations/runOperations";
import { runs } from "./operations/runs";
import { snapshots } from "./snapshots";

export const ingestionErrorCodeEnum = pgEnum("ingestion_error_code", [
  "MAPPING_ERROR",
  "PARSE_ERROR",
  "VALIDATION_ERROR",
  "SYSTEM_ERROR",
]);

export const ingestionErrors = pgTable(
  "ingestion_errors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    runStepId: uuid("run_step_id")
      .notNull()
      .references(() => runOperations.id, { onDelete: "cascade" }),
    rawRowId: uuid("raw_row_id").references(() => rawRows.id, { onDelete: "set null" }),
    code: ingestionErrorCodeEnum("code").notNull(),
    message: text("message").notNull(),
    detailsJson: jsonb("details_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ingestion_errors_snapshot_id_idx").on(table.snapshotId),
    index("ingestion_errors_run_id_idx").on(table.runId),
    index("ingestion_errors_run_step_id_idx").on(table.runStepId),
    index("ingestion_errors_raw_row_id_idx").on(table.rawRowId),
    index("ingestion_errors_code_idx").on(table.code),
  ],
);

export type InsertIngestionError = typeof ingestionErrors.$inferInsert;
export type SelectIngestionError = typeof ingestionErrors.$inferSelect;
