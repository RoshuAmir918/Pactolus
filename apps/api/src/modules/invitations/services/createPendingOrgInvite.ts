import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { organizationInvitations, organizations, users } from "@db/schema";

const { db } = dbClient;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CreatePendingOrgInviteInput = {
  organizationName: string;
  inviteEmail: string;
  invitedByUserId: string;
};

export type CreatePendingOrgInviteResult = {
  organizationId: string;
  organizationName: string;
  inviteEmail: string;
  token: string;
  expiresAt: Date;
};

export async function createPendingOrgInvite(
  input: CreatePendingOrgInviteInput,
): Promise<CreatePendingOrgInviteResult> {
  const organizationName = input.organizationName.trim();
  const inviteEmail = input.inviteEmail.trim().toLowerCase();

  if (!organizationName) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization name is required",
    });
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${inviteEmail}`)
    .limit(1);

  if (existingUser) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A user with this email already exists",
    });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const token = randomBytes(32).toString("hex");

  const created = await db.transaction(async (tx) => {
    const [existingPending] = await tx
      .select({
        invitationId: organizationInvitations.id,
        organizationId: organizations.id,
        organizationName: organizations.name,
      })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizations.id, organizationInvitations.orgId))
      .where(
        and(
          sql`lower(${organizationInvitations.email}) = ${inviteEmail}`,
          eq(organizationInvitations.status, "pending"),
          eq(organizations.status, "pending"),
        ),
      )
      .limit(1);

    if (existingPending) {
      const now = new Date();

      await tx
        .update(organizations)
        .set({
          name: organizationName,
          updatedAt: now,
        })
        .where(eq(organizations.id, existingPending.organizationId));

      await tx
        .update(organizationInvitations)
        .set({
          token,
          expiresAt,
          invitedByUserId: input.invitedByUserId,
          updatedAt: now,
        })
        .where(eq(organizationInvitations.id, existingPending.invitationId));

      return {
        id: existingPending.organizationId,
        name: organizationName,
      };
    }

    const [org] = await tx
      .insert(organizations)
      .values({
        name: organizationName,
        status: "pending",
      })
      .returning({
        id: organizations.id,
        name: organizations.name,
      });

    await tx.insert(organizationInvitations).values({
      orgId: org.id,
      email: inviteEmail,
      token,
      role: "admin",
      status: "pending",
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    });

    return org;
  });

  return {
    organizationId: created.id,
    organizationName: created.name,
    inviteEmail,
    token,
    expiresAt,
  };
}
