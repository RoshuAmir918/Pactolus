import { eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { organizationInvitations, organizations } from "@db/schema";

const { db } = dbClient;

export type InvitationInfoResult =
  | {
      valid: true;
      organizationName: string;
      inviteEmail: string;
      expiresAt: Date;
      organizationStatus: "pending" | "active" | "inactive" | "archived";
    }
  | {
      valid: false;
      reason: "not_found" | "expired" | "used";
    };

export async function getInvitationInfo(token: string): Promise<InvitationInfoResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return { valid: false, reason: "not_found" };
  }

  const [invitation] = await db
    .select({
      email: organizationInvitations.email,
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
    return { valid: false, reason: "not_found" };
  }

  if (invitation.status !== "pending" || invitation.usedAt !== null) {
    return { valid: false, reason: "used" };
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: "expired" };
  }

  return {
    valid: true,
    organizationName: invitation.organizationName,
    inviteEmail: invitation.email,
    expiresAt: invitation.expiresAt,
    organizationStatus: invitation.organizationStatus,
  };
}
