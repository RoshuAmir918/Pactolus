import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { mappingRuns } from "./mappingRuns";
import { rawRows } from "./rawRows";
import { snapshots } from "./snapshots";

export const policiesCanonical = pgTable(
  "policies_canonical",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    mappingRunId: uuid("mapping_run_id")
      .notNull()
      .references(() => mappingRuns.id, { onDelete: "cascade" }),
    rawRowId: uuid("raw_row_id")
      .notNull()
      .references(() => rawRows.id, { onDelete: "cascade" }),
    policyNumber: text("policy_number").notNull(),
    effectiveDate: date("effective_date").notNull(),
    expirationDate: date("expiration_date").notNull(),
    insuredName: text("insured_name"),
    lineOfBusiness: text("line_of_business"),
    attachmentPoint: numeric("attachment_point", { precision: 18, scale: 2 }),
    grossPremium: numeric("gross_premium", { precision: 18, scale: 2 }),
    riskState: text("risk_state"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("policies_canonical_run_raw_row_unique").on(
      table.mappingRunId,
      table.rawRowId,
    ),
    index("policies_canonical_snapshot_id_idx").on(table.snapshotId),
    index("policies_canonical_mapping_run_id_idx").on(table.mappingRunId),
    index("policies_canonical_policy_number_idx").on(table.policyNumber),
  ],
);

export type InsertPolicyCanonical = typeof policiesCanonical.$inferInsert;
export type SelectPolicyCanonical = typeof policiesCanonical.$inferSelect;
