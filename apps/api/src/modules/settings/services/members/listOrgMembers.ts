import { and, asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { organizationInvitations, memberships, users } from "@db/schema";

const { db } = dbClient;

export async function listOrgMembers(orgId: string) {
  const memberRows = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      email: users.email,
      fullName: users.fullName,
      role: memberships.role,
      status: memberships.status,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.status, "active")))
    .orderBy(asc(users.email));

  const pendingInvitesRaw = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      expiresAt: organizationInvitations.expiresAt,
      invitedAt: organizationInvitations.createdAt,
    })
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.orgId, orgId),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .orderBy(asc(organizationInvitations.email));

  return {
    members: memberRows,
    pendingInvites: pendingInvitesRaw,
  };
}

export type ListOrgMembersResult = Awaited<ReturnType<typeof listOrgMembers>>;
export type OrgMemberRow = ListOrgMembersResult["members"][number];
export type PendingInviteRow = ListOrgMembersResult["pendingInvites"][number];
