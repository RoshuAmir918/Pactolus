import bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import dbClient from "@api/db/client";
import { memberships, users } from "@db/schema";

const { db } = dbClient;

export type SessionUser = {
    userId: string;
    orgId: string;
    role: "admin" | "manager" | "analyst";
};

declare global {
    namespace Express {
        interface User extends SessionUser {}
    }
}

passport.use(
    new LocalStrategy(
        {
            usernameField: "email",
            passwordField: "password",
        },
        async (email, password, done) => {
            try {
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email))
                    .limit(1);

                if (!user) {
                    return done(null, false, { message: "User not found" });
                }
                if (!user.password) {
                    return done(null, false, { message: "User has no password set" });
                }

                const valid = await bcrypt.compare(password, user.password);
                if (!valid) {
                    return done(null, false, { message: "Invalid password" });
                }

                const [membership] = await db
                    .select({
                        userId: memberships.userId,
                        orgId: memberships.orgId,
                        role: memberships.role,
                    })
                    .from(memberships)
                    .where(
                        and(
                            eq(memberships.userId, user.id),
                            eq(memberships.status, "active"),
                        ),
                    )
                    .limit(1);

                if (!membership) {
                    return done(null, false, { message: "No active membership" });
                }

                done(null, {
                    userId: membership.userId,
                    orgId: membership.orgId,
                    role: membership.role,
                });
            } catch (err) {
                done(err);
            }
        },
    ),
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: SessionUser, done) => done(null, user));
