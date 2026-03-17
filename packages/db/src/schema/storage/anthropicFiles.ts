import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const anthropicFileStatusEnum = pgEnum("anthropic_file_status", ["active", "deleted"]);

export const anthropicFiles = pgTable(
  "anthropic_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    anthropicFileId: text("anthropic_file_id").notNull(),
    originalFilename: text("original_filename").notNull(),
    fileType: text("file_type").notNull(),
    status: anthropicFileStatusEnum("status").notNull().default("active"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("anthropic_files_file_id_unique").on(table.anthropicFileId),
    index("anthropic_files_status_idx").on(table.status),
  ],
);

export type InsertAnthropicFile = typeof anthropicFiles.$inferInsert;
export type SelectAnthropicFile = typeof anthropicFiles.$inferSelect;
