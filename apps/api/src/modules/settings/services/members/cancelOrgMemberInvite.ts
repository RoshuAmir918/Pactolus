import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { organizationInvitations } from "@db/schema";

const { db } = dbClient;

export async function cancelOrgMemberInvite(input: {
  orgId: string;
  invitationId: string;
}): Promise<void> {
  const removed = await db
    .delete(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.id, input.invitationId),
        eq(organizationInvitations.orgId, input.orgId),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .returning({ id: organizationInvitations.id });

  if (removed.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found or already accepted.",
    });
  }
}
