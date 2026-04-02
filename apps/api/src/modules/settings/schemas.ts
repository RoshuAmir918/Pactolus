import { z } from "zod";

export const membershipRoleSchema = z.enum(["admin", "manager", "analyst"]);

export const settingsMembersInviteInputSchema = z.object({
  inviteEmail: z.string().trim().email(),
  role: membershipRoleSchema.optional().default("analyst"),
});

export const settingsMembersInviteOutputSchema = z.object({
  inviteEmail: z.string().email(),
  expiresAt: z.date(),
});

export const settingsMembersCancelInviteInputSchema = z.object({
  invitationId: z.uuid(),
});

export const settingsMembersRemoveInputSchema = z.object({
  targetUserId: z.uuid(),
});

export const settingsMembersUpdateRoleInputSchema = z.object({
  targetUserId: z.uuid(),
  role: membershipRoleSchema,
});

export const settingsMembersListOutputSchema = z.object({
  members: z.array(
    z.object({
      membershipId: z.uuid(),
      userId: z.uuid(),
      email: z.string(),
      fullName: z.string(),
      role: membershipRoleSchema,
      status: z.enum(["active", "invited", "suspended"]),
      joinedAt: z.date().nullable(),
    }),
  ),
  pendingInvites: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      role: membershipRoleSchema,
      expiresAt: z.date(),
      invitedAt: z.date(),
    }),
  ),
});
