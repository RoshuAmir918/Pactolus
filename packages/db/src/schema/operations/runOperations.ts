import { foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { documents } from "../storage/documents";
import { users } from "../users";
import { runs } from "./runs";

export const runOperationActorTypeEnum = pgEnum("run_operation_actor_type", [
  "user",
  "ai",
  "system",
]);

export const runOperations = pgTable(
  "run_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    operationIndex: integer("operation_index").notNull(),
    parentOperationId: uuid("parent_operation_id"),
    operationType: text("operation_type").notNull(),
    actorType: runOperationActorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key"),
    parametersJson: jsonb("parameters_json").notNull(),
    supersedesOperationId: uuid("supersedes_operation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentOperationId],
      foreignColumns: [table.id],
      name: "run_operations_parent_operation_id_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.supersedesOperationId],
      foreignColumns: [table.id],
      name: "run_operations_supersedes_operation_id_fk",
    }).onDelete("set null"),
    uniqueIndex("run_operations_run_operation_index_unique").on(table.runId, table.operationIndex),
    uniqueIndex("run_operations_run_idempotency_key_unique").on(table.runId, table.idempotencyKey),
    index("run_operations_run_id_idx").on(table.runId),
    index("run_operations_document_id_idx").on(table.documentId),
    index("run_operations_parent_operation_id_idx").on(table.parentOperationId),
    index("run_operations_operation_type_idx").on(table.operationType),
    index("run_operations_actor_type_idx").on(table.actorType),
    index("run_operations_actor_id_idx").on(table.actorId),
    index("run_operations_supersedes_operation_id_idx").on(table.supersedesOperationId),
  ],
);

export type InsertRunOperation = typeof runOperations.$inferInsert;
export type SelectRunOperation = typeof runOperations.$inferSelect;
