import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const organizationInvitationRoleEnum = pgEnum(
  "organization_invitation_role",
  ["admin", "manager", "analyst"],
);

export const organizationInvitationStatusEnum = pgEnum(
  "organization_invitation_status",
  ["pending", "accepted"],
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    email: text("email").notNull(),

    token: text("token").notNull(),

    role: organizationInvitationRoleEnum("role").notNull(),

    status: organizationInvitationStatusEnum("status")
      .notNull()
      .default("pending"),

    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("organization_invitations_token_idx").on(table.token),
    index("organization_invitations_org_id_idx").on(table.orgId),
    index("organization_invitations_email_idx").on(table.email),
  ],
);

export type InsertOrganizationInvitation =
  typeof organizationInvitations.$inferInsert;
export type SelectOrganizationInvitation =
  typeof organizationInvitations.$inferSelect;

