import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { snapshots } from "./snapshots";
import { snapshotInputs } from "./snapshotInputs";

export const mappingRunStatusEnum = pgEnum("mapping_run_status", [
  "pending",
  "validated",
  "failed",
]);

export const mappingRuns = pgTable(
  "mapping_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    snapshotInputId: uuid("snapshot_input_id")
      .notNull()
      .references(() => snapshotInputs.id, { onDelete: "cascade" }),
    aiProposalJson: jsonb("ai_proposal_json"),
    validatedMappingJson: jsonb("validated_mapping_json"),
    validationReportJson: jsonb("validation_report_json"),
    status: mappingRunStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("mapping_runs_snapshot_id_idx").on(table.snapshotId),
    index("mapping_runs_input_id_idx").on(table.snapshotInputId),
    index("mapping_runs_status_idx").on(table.status),
  ],
);

export type InsertMappingRun = typeof mappingRuns.$inferInsert;
export type SelectMappingRun = typeof mappingRuns.$inferSelect;
