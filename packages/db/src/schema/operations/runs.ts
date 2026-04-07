import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "../organizations";
import { snapshots } from "../snapshots";
import { users } from "../users";

export const runStatusEnum = pgEnum("analysis_run_status", [
  "draft",
  "running",
  "awaiting_confirmation",
  "ready",
  "failed",
  "locked",
]);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: runStatusEnum("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("runs_org_id_idx").on(table.orgId),
    index("runs_snapshot_id_idx").on(table.snapshotId),
    index("runs_status_idx").on(table.status),
    index("runs_created_by_user_id_idx").on(table.createdByUserId),
  ],
);

export type InsertRun = typeof runs.$inferInsert;
export type SelectRun = typeof runs.$inferSelect;
