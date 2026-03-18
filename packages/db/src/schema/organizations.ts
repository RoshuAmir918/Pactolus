import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const organizationStatusEnum = pgEnum("organization_status", [
  "pending",
  "active",
  "inactive",
  "archived",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    status: organizationStatusEnum("status").notNull().default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("organizations_status_idx").on(table.status)],
);

export type InsertOrganization = typeof organizations.$inferInsert;
export type SelectOrganization = typeof organizations.$inferSelect;