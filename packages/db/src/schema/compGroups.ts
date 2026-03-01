import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { organizations } from "./organizations";
import { datasetSnapshots } from "./snapshots";
import { users } from "./users";

export const compGroups = pgTable(
  "comp_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => datasetSnapshots.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdIdx: index("comp_groups_org_id_idx").on(table.orgId),
    dealIdIdx: index("comp_groups_deal_id_idx").on(table.dealId),
  }),
);
