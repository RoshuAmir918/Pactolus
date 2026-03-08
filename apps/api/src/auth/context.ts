import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { memberships } from "@db/schema";

const { db } = dbClient;

export type RequestContext = {
    userId: string;
    orgId: string;
    role: "admin" | "manager" | "analyst";
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
        return {
            userId: req.user.userId,
            orgId: req.user.orgId,
            role: req.user.role,
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
        })
        .from(memberships)
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
    };
}

/** Same as resolveContextOptional but throws when not authenticated. */
export async function resolveContext(req: Request): Promise<RequestContext> {
    const ctx = await resolveContextOptional(req);
    if (!ctx) throw new Error("Missing x-user-id or x-org-id");
    return ctx;
}
