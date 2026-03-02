import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { memberships } from "@db/schema";

const { db } = dbClient;

export type RequestContext = {
    userId: string;
    orgId: string;
    role: "admin" | "manager" | "analyst";
};

function getHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
): string | undefined {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
}

export async function resolveContext(
    headers: Record<string, string | string[] | undefined>,
): Promise<RequestContext> {
    const userId = getHeader(headers, "x-user-id");
    const orgId = getHeader(headers, "x-org-id");

    if (!userId || !orgId) {
        throw new Error("Missing x-user-id or x-org-id");
    }

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

    if (!membership) {
        throw new Error("No active membership for this user/org");
    }

    return {
        userId: membership.userId,
        orgId: membership.orgId,
        role: membership.role,
    };
}