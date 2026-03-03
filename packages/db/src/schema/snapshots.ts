import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const snapshotStatusEnum = pgEnum("snapshot_status", [
  "draft",
  "ingesting",
  "ready",
  "failed",
]);

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    label: text("label").notNull(),
    accountingPeriod: text("accounting_period"),
    status: snapshotStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("snapshots_org_id_idx").on(table.orgId),
    index("snapshots_created_by_user_id_idx").on(table.createdByUserId),
    index("snapshots_status_idx").on(table.status),
  ],
);

export type InsertSnapshot = typeof snapshots.$inferInsert;
export type SelectSnapshot = typeof snapshots.$inferSelect;
