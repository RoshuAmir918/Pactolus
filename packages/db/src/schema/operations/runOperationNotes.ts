import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "../organizations";
import { users } from "../users";
import { runOperations } from "./runOperations";

export const runOperationNotes = pgTable(
  "run_operation_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runOperationId: uuid("run_operation_id")
      .notNull()
      .references(() => runOperations.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    noteText: text("note_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // One editable note per operation — upsert semantics
    uniqueIndex("run_operation_notes_operation_id_unique").on(table.runOperationId),
  ],
);

export type InsertRunOperationNote = typeof runOperationNotes.$inferInsert;
export type SelectRunOperationNote = typeof runOperationNotes.$inferSelect;
