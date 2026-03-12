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
import { rawRows } from "./rawRows";
import { runOperations } from "./operations/runOperations";
import { runs } from "./operations/runs";
import { snapshots } from "./snapshots";

export const claimsCanonical = pgTable(
  "claims_canonical",
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
    rawRowId: uuid("raw_row_id")
      .notNull()
      .references(() => rawRows.id, { onDelete: "cascade" }),
    claimNumber: text("claim_number").notNull(),
    accountingPeriod: text("accounting_period"),
    evaluationDate: date("evaluation_date"),
    accidentDate: date("accident_date").notNull(),
    totalIncurred: numeric("total_incurred", { precision: 18, scale: 2 }).notNull(),
    policyNumber: text("policy_number"),
    paidIndemnity: numeric("paid_indemnity", { precision: 18, scale: 2 }),
    paidMedical: numeric("paid_medical", { precision: 18, scale: 2 }),
    paidExpense: numeric("paid_expense", { precision: 18, scale: 2 }),
    osIndemnity: numeric("os_indemnity", { precision: 18, scale: 2 }),
    osMedical: numeric("os_medical", { precision: 18, scale: 2 }),
    osExpense: numeric("os_expense", { precision: 18, scale: 2 }),
    lineOfBusiness: text("line_of_business"),
    cedent: text("cedent"),
    profitCenter: text("profit_center"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("claims_canonical_step_raw_row_unique").on(table.runStepId, table.rawRowId),
    index("claims_canonical_snapshot_id_idx").on(table.snapshotId),
    index("claims_canonical_run_id_idx").on(table.runId),
    index("claims_canonical_run_step_id_idx").on(table.runStepId),
    index("claims_canonical_claim_number_idx").on(table.claimNumber),
  ],
);

export type InsertClaimCanonical = typeof claimsCanonical.$inferInsert;
export type SelectClaimCanonical = typeof claimsCanonical.$inferSelect;
