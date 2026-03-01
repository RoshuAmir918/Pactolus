import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { compGroups } from "./compGroups";
import { organizations } from "./organizations";
import { users } from "./users";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    compGroupId: uuid("comp_group_id")
      .notNull()
      .references(() => compGroups.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdIdx: index("reviews_org_id_idx").on(table.orgId),
    compGroupIdIdx: index("reviews_comp_group_id_idx").on(table.compGroupId),
  }),
);
