import {
    index,
    pgEnum,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const membershipRoleEnum = pgEnum("membership_role", [
    "admin",
    "manager",
    "analyst",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
    "active",
    "invited",
    "suspended",
]);

export const memberships = pgTable(
    "memberships",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        orgId: uuid("org_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        role: membershipRoleEnum("role").notNull().default("analyst"),
        status: membershipStatusEnum("status").notNull().default("active"),
        invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        joinedAt: timestamp("joined_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("memberships_user_org_unique").on(table.userId, table.orgId),
        index("memberships_org_id_idx").on(table.orgId),
        index("memberships_user_id_idx").on(table.userId),
        index("memberships_org_role_idx").on(table.orgId, table.role),
    ],
);

export type InsertMembership = typeof memberships.$inferInsert;
export type SelectMembership = typeof memberships.$inferSelect;