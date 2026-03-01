import { index, integer, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { compGroups } from "./compGroups";
import { organizations } from "./organizations";

export const computedMetrics = pgTable(
  "computed_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    compGroupId: uuid("comp_group_id")
      .notNull()
      .references(() => compGroups.id, { onDelete: "cascade" }),
    dealCount: integer("deal_count").notNull().default(0),
    medianEvToRevenue: numeric("median_ev_to_revenue", {
      precision: 18,
      scale: 4,
    }),
    medianEvToEbitda: numeric("median_ev_to_ebitda", {
      precision: 18,
      scale: 4,
    }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdIdx: index("computed_metrics_org_id_idx").on(table.orgId),
    compGroupIdIdx: index("computed_metrics_comp_group_id_idx").on(table.compGroupId),
  }),
);
