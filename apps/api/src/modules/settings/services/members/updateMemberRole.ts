import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { memberships } from "@db/schema";

const { db } = dbClient;

export type UpdateMemberRoleInput = {
  orgId: string;
  actorUserId: string;
  targetUserId: string;
  role: "admin" | "manager" | "analyst";
};

export async function updateMemberRole(input: UpdateMemberRoleInput): Promise<void> {
  if (input.targetUserId === input.actorUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You cannot change your own role here.",
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

  const now = new Date();
  await db
    .update(memberships)
    .set({ role: input.role, updatedAt: now })
    .where(eq(memberships.id, membership.id));
}
