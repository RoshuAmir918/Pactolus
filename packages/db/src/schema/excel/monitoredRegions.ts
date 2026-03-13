import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "../organizations";
import { snapshots } from "../snapshots";
import { users } from "../users";

export const excelMonitoredRegionTypeEnum = pgEnum("excel_monitored_region_type", [
  "input",
  "output",
]);

export const excelMonitoredRegionStatusEnum = pgEnum("excel_monitored_region_status", [
  "active",
  "archived",
]);

export const excelMonitoredRegions = pgTable(
  "excel_monitored_regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    sheetName: text("sheet_name").notNull(),
    address: text("address").notNull(),
    regionType: excelMonitoredRegionTypeEnum("region_type").notNull(),
    confidencePercent: integer("confidence_percent").notNull().default(0),
    userConfirmed: boolean("user_confirmed").notNull().default(false),
    status: excelMonitoredRegionStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("excel_monitored_regions_unique").on(
      table.snapshotId,
      table.sheetName,
      table.address,
      table.regionType,
    ),
    index("excel_monitored_regions_org_id_idx").on(table.orgId),
    index("excel_monitored_regions_snapshot_id_idx").on(table.snapshotId),
    index("excel_monitored_regions_sheet_name_idx").on(table.sheetName),
    index("excel_monitored_regions_region_type_idx").on(table.regionType),
    index("excel_monitored_regions_status_idx").on(table.status),
  ],
);

export type InsertExcelMonitoredRegion = typeof excelMonitoredRegions.$inferInsert;
export type SelectExcelMonitoredRegion = typeof excelMonitoredRegions.$inferSelect;
