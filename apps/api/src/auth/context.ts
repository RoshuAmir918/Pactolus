import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { memberships, users } from "@db/schema";

const { db } = dbClient;

export type RequestContext = {
    userId: string;
    orgId: string;
    role: "admin" | "manager" | "analyst";
    isSuperUser: boolean;
    email: string;
    fullName: string;
};

/** tRPC context: req, res, and optional user (null when not authenticated). */
export type TRPCContext = {
    req: Request;
    res: Response;
    user: RequestContext | null;
};

function getHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
): string | undefined {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
}


/** Returns the current user from session or headers, or null if not authenticated. */
export async function resolveContextOptional(req: Request): Promise<RequestContext | null> {
    if (req.isAuthenticated() && req.user) {
        const sessionUser = req.user;

        // Profile fields always come from DB so stale sessions (wrong or missing fullName) stay correct.
        const [profile] = await db
            .select({ email: users.email, fullName: users.fullName })
            .from(users)
            .where(eq(users.id, sessionUser.userId))
            .limit(1);

        return {
            userId: sessionUser.userId,
            orgId: sessionUser.orgId,
            role: sessionUser.role,
            isSuperUser: sessionUser.isSuperUser,
            email: profile?.email ?? sessionUser.email ?? "",
            fullName: profile?.fullName ?? sessionUser.fullName ?? "",
        };
    }


    const userId = getHeader(req.headers as Record<string, string | string[] | undefined>, "x-user-id");
    const orgId = getHeader(req.headers as Record<string, string | string[] | undefined>, "x-org-id");

    if (!userId || !orgId) return null;

    const [membership] = await db
        .select({
            userId: memberships.userId,
            orgId: memberships.orgId,
            role: memberships.role,
            status: memberships.status,
            isSuperUser: users.isSuperUser,
            email: users.email,
            fullName: users.fullName,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
            and(
                eq(memberships.userId, userId),
                eq(memberships.orgId, orgId),
                eq(memberships.status, "active"),
            ),
        )
        .limit(1);

    if (!membership) return null;

    return {
        userId: membership.userId,
        orgId: membership.orgId,
        role: membership.role,
        isSuperUser: membership.isSuperUser,
        email: membership.email,
        fullName: membership.fullName,
    };
}

/** Same as resolveContextOptional but throws when not authenticated. */
export async function resolveContext(req: Request): Promise<RequestContext> {
    const ctx = await resolveContextOptional(req);
    if (!ctx) throw new Error("Missing x-user-id or x-org-id");
    return ctx;
}
