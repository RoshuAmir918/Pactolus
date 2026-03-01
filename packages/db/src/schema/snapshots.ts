import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { organizations } from "./organizations";
import { users } from "./users";

export const datasetSnapshots = pgTable(
  "dataset_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: text("source").notNull().default("csv"),
    status: text("status").notNull().default("ready"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdIdx: index("dataset_snapshots_org_id_idx").on(table.orgId),
    dealIdIdx: index("dataset_snapshots_deal_id_idx").on(table.dealId),
  }),
);
