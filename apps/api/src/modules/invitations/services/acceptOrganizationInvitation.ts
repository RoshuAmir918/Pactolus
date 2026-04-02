import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { memberships, organizationInvitations, organizations, users } from "@db/schema";

const { db } = dbClient;

export type AcceptOrganizationInvitationInput = {
  token: string;
  fullName: string;
  password: string;
};

export type AcceptOrganizationInvitationResult = {
  ok: true;
  organizationName: string;
  inviteEmail: string;
};

export async function acceptOrganizationInvitation(
  input: AcceptOrganizationInvitationInput,
): Promise<AcceptOrganizationInvitationResult> {
  const normalizedToken = input.token.trim();
  const fullName = input.fullName.trim();

  if (!normalizedToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invite token is required" });
  }
  if (!fullName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Full name is required" });
  }

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

  const normalizedEmail = invitation.email.trim().toLowerCase();
  const orgIsPending = invitation.organizationStatus === "pending";

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingUser) {
    if (orgIsPending) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account with this invite email already exists",
      });
    }
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "An account with this email already exists. Log in with that account and open this invite link again to join.",
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();

  await db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        authProvider: "firebase",
        authSubjectId: randomUUID(),
        email: normalizedEmail,
        password: passwordHash,
        fullName,
        status: "active",
      })
      .returning({ id: users.id });

    await tx.insert(memberships).values({
      userId: createdUser.id,
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

    if (orgIsPending) {
      await tx
        .update(organizations)
        .set({
          status: "active",
          updatedAt: now,
        })
        .where(eq(organizations.id, invitation.orgId));
    }
  });

  return {
    ok: true,
    organizationName: invitation.organizationName,
    inviteEmail: normalizedEmail,
  };
}
