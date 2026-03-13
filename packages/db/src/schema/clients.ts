import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const clientStatusEnum = pgEnum("client_status", ["active", "archived"]);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    externalKey: text("external_key"),
    metadataJson: jsonb("metadata_json"),
    status: clientStatusEnum("status").notNull().default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("clients_org_name_unique").on(table.orgId, table.name),
    index("clients_org_id_idx").on(table.orgId),
    index("clients_status_idx").on(table.status),
    index("clients_external_key_idx").on(table.externalKey),
  ],
);

export type InsertClient = typeof clients.$inferInsert;
export type SelectClient = typeof clients.$inferSelect;
