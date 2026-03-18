import {
    boolean,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", [
    "firebase",
    "auth0",
    "cognito",
    "google",
    "microsoft",
    "saml",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "invited",
  "suspended",
  "inactive",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authProvider: authProviderEnum("auth_provider").notNull(),
    authSubjectId: text("auth_subject_id").notNull(),
    email: text("email").notNull(),
    password: text('password').notNull(),
    fullName: text("full_name").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    isSuperUser: boolean("is_super_user").notNull().default(false),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_provider_subject_unique").on(
      table.authProvider,
      table.authSubjectId,
    ),
    index("users_status_idx").on(table.status),
  ],
);

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;