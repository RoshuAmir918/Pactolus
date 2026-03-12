import { foreignKey, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { runs } from "./runs";
import { users } from "../users";

export const runBranchStatusEnum = pgEnum("run_branch_status", ["active", "archived"]);

export const runBranches = pgTable(
  "run_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    parentBranchId: uuid("parent_branch_id"),
    forkedFromStepId: uuid("forked_from_step_id"),
    name: text("name").notNull(),
    status: runBranchStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentBranchId],
      foreignColumns: [table.id],
      name: "run_branches_parent_branch_id_run_branches_id_fk",
    }).onDelete("set null"),
    index("run_branches_run_id_idx").on(table.runId),
    index("run_branches_parent_branch_id_idx").on(table.parentBranchId),
    index("run_branches_forked_from_step_id_idx").on(table.forkedFromStepId),
    index("run_branches_status_idx").on(table.status),
    index("run_branches_created_by_user_id_idx").on(table.createdByUserId),
  ],
);

export type InsertRunBranch = typeof runBranches.$inferInsert;
export type SelectRunBranch = typeof runBranches.$inferSelect;
