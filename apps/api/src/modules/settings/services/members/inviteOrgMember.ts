import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { sendMemberInviteEmail } from "@api/modules/invitations/services/sendMemberInviteEmail";
import {
  memberships,
  organizationInvitations,
  organizations,
  users,
} from "@db/schema";

const { db } = dbClient;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteOrgMemberInput = {
  orgId: string;
  actorUserId: string;
  inviteEmail: string;
  role: "admin" | "manager" | "analyst";
};

export type InviteOrgMemberResult = {
  inviteEmail: string;
  expiresAt: Date;
};

export async function inviteOrgMember(input: InviteOrgMemberInput): Promise<InviteOrgMemberResult> {
  const inviteEmail = input.inviteEmail.trim().toLowerCase();
  if (!inviteEmail) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Email is required" });
  }

  const [org] = await db
    .select({ name: organizations.name, status: organizations.status })
    .from(organizations)
    .where(eq(organizations.id, input.orgId))
    .limit(1);

  if (!org || org.status !== "active") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Organization is not active" });
  }

  const [existingMember] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.orgId, input.orgId),
        eq(memberships.status, "active"),
        sql`lower(${users.email}) = ${inviteEmail}`,
      ),
    )
    .limit(1);

  if (existingMember) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This user is already a member of the organization.",
    });
  }

  const [pending] = await db
    .select({ id: organizationInvitations.id })
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.orgId, input.orgId),
        eq(organizationInvitations.status, "pending"),
        sql`lower(${organizationInvitations.email}) = ${inviteEmail}`,
      ),
    )
    .limit(1);

  if (pending) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "An invitation is already pending for this email.",
    });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const token = randomBytes(32).toString("hex");

  await db.insert(organizationInvitations).values({
    orgId: input.orgId,
    email: inviteEmail,
    token,
    role: input.role,
    status: "pending",
    invitedByUserId: input.actorUserId,
    expiresAt,
  });

  await sendMemberInviteEmail({
    toEmail: inviteEmail,
    organizationName: org.name,
    token,
  });

  return { inviteEmail, expiresAt };
}
