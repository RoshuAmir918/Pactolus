import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { runOperations } from "./runOperations";

export const runPipelineContextTypeEnum = pgEnum("run_pipeline_context_type", [
  "AI_RAW_RESPONSE",
  "MAPPING_VALIDATION_REPORT",
  "CANONICALIZATION_SUMMARY",
]);

export const runPipelineContext = pgTable(
  "run_pipeline_context",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runStepId: uuid("run_step_id")
      .notNull()
      .references(() => runOperations.id, { onDelete: "cascade" }),
    contextType: runPipelineContextTypeEnum("context_type").notNull(),
    dataJson: jsonb("data_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("run_pipeline_context_step_type_unique").on(
      table.runStepId,
      table.contextType,
    ),
    index("run_pipeline_context_run_step_id_idx").on(table.runStepId),
    index("run_pipeline_context_context_type_idx").on(table.contextType),
  ],
);

export type InsertRunPipelineContext = typeof runPipelineContext.$inferInsert;
export type SelectRunPipelineContext = typeof runPipelineContext.$inferSelect;
