import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { memberships } from "@db/schema";

const { db } = dbClient;

export type RemoveOrgMemberInput = {
  orgId: string;
  actorUserId: string;
  targetUserId: string;
};

export async function removeOrgMember(input: RemoveOrgMemberInput): Promise<void> {
  if (input.actorUserId === input.targetUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Ask another admin to remove you from the organization.",
    });
  }

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.orgId, input.orgId),
        eq(memberships.userId, input.targetUserId),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
  }

  await db.delete(memberships).where(eq(memberships.id, membership.id));
}
