import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { runSteps } from "./runSteps";

export const runStepArtifactTypeEnum = pgEnum("run_step_artifact_type", [
  "AI_RAW_RESPONSE",
  "MAPPING_VALIDATION_REPORT",
  "CANONICALIZATION_SUMMARY",
]);

export const runStepArtifacts = pgTable(
  "run_step_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runStepId: uuid("run_step_id")
      .notNull()
      .references(() => runSteps.id, { onDelete: "cascade" }),
    artifactType: runStepArtifactTypeEnum("artifact_type").notNull(),
    dataJson: jsonb("data_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("run_step_artifacts_step_type_unique").on(
      table.runStepId,
      table.artifactType,
    ),
    index("run_step_artifacts_run_step_id_idx").on(table.runStepId),
    index("run_step_artifacts_artifact_type_idx").on(table.artifactType),
  ],
);

export type InsertRunStepArtifact = typeof runStepArtifacts.$inferInsert;
export type SelectRunStepArtifact = typeof runStepArtifacts.$inferSelect;
