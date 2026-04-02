import { and, asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { organizationInvitations, memberships, users } from "@db/schema";

const { db } = dbClient;

export type OrgMemberRow = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "analyst";
  status: "active" | "invited" | "suspended";
  joinedAt: Date | null;
};

export type PendingInviteRow = {
  id: string;
  email: string;
  role: "admin" | "manager" | "analyst";
  expiresAt: Date;
  invitedAt: Date;
};

export type ListOrgMembersResult = {
  members: OrgMemberRow[];
  pendingInvites: PendingInviteRow[];
};

export async function listOrgMembers(orgId: string): Promise<ListOrgMembersResult> {
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

  const members: OrgMemberRow[] = memberRows.map((row) => ({
    membershipId: row.membershipId,
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    joinedAt: row.joinedAt,
  }));

  const pendingInvitesRaw = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      expiresAt: organizationInvitations.expiresAt,
      createdAt: organizationInvitations.createdAt,
    })
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.orgId, orgId),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .orderBy(asc(organizationInvitations.email));

  const pendingInvites: PendingInviteRow[] = pendingInvitesRaw.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expiresAt,
    invitedAt: row.createdAt,
  }));

  return {
    members,
    pendingInvites,
  };
}
