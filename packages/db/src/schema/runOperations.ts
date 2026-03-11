import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { snapshotInputs } from "./snapshotInputs";
import { runs } from "./runs";
import { users } from "./users";

export const runOperationTypeEnum = pgEnum("run_step_type", [
  "UPLOAD_DATASET",
  "APPLY_MAPPING_TEMPLATE",
  "SUGGESTED_MAPPING",
  "ACCEPTED_MAPPING",
  "REJECTED_MAPPING",
  "CANONICALIZE_CLAIMS",
  "CANONICALIZE_POLICIES",
  "SET_FILTERS",
  "SET_GROUPING",
  "SET_METRIC_DEFINITION",
  "RUN_RECONCILIATION",
  "RUN_AGGREGATION",
  "SET_OUTLIER_THRESHOLD",
  "LOCK_RUN",
]);

export const runOperationActorTypeEnum = pgEnum("run_step_actor_type", [
  "user",
  "ai",
  "system",
]);

export const runOperations = pgTable(
  "run_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    snapshotInputId: uuid("snapshot_input_id").references(() => snapshotInputs.id, {
      onDelete: "cascade",
    }),
    stepIndex: integer("step_index").notNull(),
    stepType: runOperationTypeEnum("step_type").notNull(),
    actorType: runOperationActorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    parametersJson: jsonb("parameters_json").notNull(),
    supersedesStepId: uuid("supersedes_step_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.supersedesStepId],
      foreignColumns: [table.id],
      name: "run_steps_supersedes_step_id_run_steps_id_fk",
    }).onDelete("set null"),
    uniqueIndex("run_steps_run_step_index_unique").on(table.runId, table.stepIndex),
    index("run_steps_run_id_idx").on(table.runId),
    index("run_steps_snapshot_input_id_idx").on(table.snapshotInputId),
    index("run_steps_step_type_idx").on(table.stepType),
    index("run_steps_actor_type_idx").on(table.actorType),
    index("run_steps_actor_id_idx").on(table.actorId),
    index("run_steps_supersedes_step_id_idx").on(table.supersedesStepId),
  ],
);

export type InsertRunOperation = typeof runOperations.$inferInsert;
export type SelectRunOperation = typeof runOperations.$inferSelect;

