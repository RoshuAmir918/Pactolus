import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { runOperations } from "./runOperations";

export const runOperationCaptures = pgTable(
  "run_operation_captures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runOperationId: uuid("run_operation_id")
      .notNull()
      .references(() => runOperations.id, { onDelete: "cascade" }),
    // text enum — no migration needed to add new types
    // known values: "output_values" | "narrative" | "detected_regions"
    captureType: text("capture_type").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    summaryText: text("summary_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("run_operation_captures_operation_id_idx").on(table.runOperationId),
    index("run_operation_captures_capture_type_idx").on(table.captureType),
  ],
);

export type InsertRunOperationCapture = typeof runOperationCaptures.$inferInsert;
export type SelectRunOperationCapture = typeof runOperationCaptures.$inferSelect;
