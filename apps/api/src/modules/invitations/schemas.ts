import { z } from "zod";

export const createOrgInviteInputSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
  inviteEmail: z.string().trim().email(),
});

export const createOrgInviteOutputSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  inviteEmail: z.string().email(),
  expiresAt: z.date(),
});

export const getInvitationInfoInputSchema = z.object({
  token: z.string().trim().min(1),
});

const organizationStatusSchema = z.enum([
  "pending",
  "active",
  "inactive",
  "archived",
]);

const getInvitationInfoValidOutputSchema = z.object({
  valid: z.literal(true),
  organizationName: z.string(),
  inviteEmail: z.string().email(),
  expiresAt: z.date(),
  organizationStatus: organizationStatusSchema,
});

const getInvitationInfoInvalidOutputSchema = z.object({
  valid: z.literal(false),
  reason: z.enum(["not_found", "expired", "used"]),
});

export const getInvitationInfoOutputSchema = z.discriminatedUnion("valid", [
  getInvitationInfoValidOutputSchema,
  getInvitationInfoInvalidOutputSchema,
]);

export const acceptOrganizationInvitationInputSchema = z.object({
  token: z.string().trim().min(1),
  fullName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
});

export const acceptOrganizationInvitationOutputSchema = z.object({
  ok: z.literal(true),
  organizationName: z.string(),
  inviteEmail: z.string().email(),
});

export const joinOrgWithTokenInputSchema = z.object({
  token: z.string().trim().min(1),
});

export const joinOrgWithTokenOutputSchema = z.object({
  ok: z.literal(true),
  organizationName: z.string(),
  inviteEmail: z.string().email(),
});

