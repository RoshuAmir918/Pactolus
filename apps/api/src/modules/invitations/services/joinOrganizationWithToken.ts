import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import type { SessionUser } from "@api/auth/passport";
import {
  memberships,
  organizationInvitations,
  organizations,
  users,
} from "@db/schema";

const { db } = dbClient;

export type JoinOrganizationWithTokenInput = {
  req: Request;
  userId: string;
  token: string;
};

export type JoinOrganizationWithTokenResult = {
  ok: true;
  organizationName: string;
  inviteEmail: string;
};

export async function joinOrganizationWithToken(
  input: JoinOrganizationWithTokenInput,
): Promise<JoinOrganizationWithTokenResult> {
  const normalizedToken = input.token.trim();
  if (!normalizedToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Token is required" });
  }

  const [actor] = await db
    .select({
      email: users.email,
      fullName: users.fullName,
      isSuperUser: users.isSuperUser,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!actor) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }

  const actorEmail = actor.email.trim().toLowerCase();

  const [invitation] = await db
    .select({
      id: organizationInvitations.id,
      orgId: organizationInvitations.orgId,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      invitedByUserId: organizationInvitations.invitedByUserId,
      status: organizationInvitations.status,
      expiresAt: organizationInvitations.expiresAt,
      usedAt: organizationInvitations.usedAt,
      organizationName: organizations.name,
      organizationStatus: organizations.status,
    })
    .from(organizationInvitations)
    .innerJoin(organizations, eq(organizations.id, organizationInvitations.orgId))
    .where(eq(organizationInvitations.token, normalizedToken))
    .limit(1);

  if (!invitation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
  }
  if (invitation.status !== "pending" || invitation.usedAt !== null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has already been used" });
  }
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired" });
  }

  if (invitation.organizationStatus !== "active") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use the signup form on this page to activate a new organization.",
    });
  }

  const inviteEmail = invitation.email.trim().toLowerCase();
  if (actorEmail !== inviteEmail) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be signed in with the invited email address to accept this invite.",
    });
  }

  const [existingMembership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, input.userId),
        eq(memberships.orgId, invitation.orgId),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1);

  if (existingMembership) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "You are already a member of this organization.",
    });
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(memberships).values({
      userId: input.userId,
      orgId: invitation.orgId,
      role: invitation.role,
      status: "active",
      invitedByUserId: invitation.invitedByUserId,
      joinedAt: now,
    });

    await tx
      .update(organizationInvitations)
      .set({
        status: "accepted",
        usedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(organizationInvitations.id, invitation.id),
          eq(organizationInvitations.status, "pending"),
        ),
      );
  });

  const sessionUser: SessionUser = {
    userId: input.userId,
    orgId: invitation.orgId,
    role: invitation.role,
    isSuperUser: actor.isSuperUser,
    email: actor.email,
    fullName: actor.fullName,
  };

  await new Promise<void>((resolve, reject) => {
    input.req.login(sessionUser, (err: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return {
    ok: true,
    organizationName: invitation.organizationName,
    inviteEmail: invitation.email.trim().toLowerCase(),
  };
}
