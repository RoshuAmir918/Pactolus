import {
  authenticatedProcedure,
  publicProcedure,
  router,
  superUserProcedure,
} from "@api/trpc/base";
import {
  acceptOrganizationInvitation,
  type AcceptOrganizationInvitationResult,
} from "./services/acceptOrganizationInvitation";
import { createPendingOrgInvite } from "./services/createPendingOrgInvite";
import {
  getInvitationInfo,
  type InvitationInfoResult,
} from "./services/getInvitationInfo";
import { sendInviteEmail } from "./services/sendInviteEmail";
import { joinOrganizationWithToken } from "./services/joinOrganizationWithToken";
import {
  acceptOrganizationInvitationInputSchema,
  acceptOrganizationInvitationOutputSchema,
  createOrgInviteInputSchema,
  createOrgInviteOutputSchema,
  getInvitationInfoInputSchema,
  getInvitationInfoOutputSchema,
  joinOrgWithTokenInputSchema,
  joinOrgWithTokenOutputSchema,
} from "./schemas";

export type CreateOrgInviteResult = {
  organizationId: string;
  organizationName: string;
  inviteEmail: string;
  expiresAt: Date;
};

export const invitationsRouter = router({
  createOrgInvite: superUserProcedure
    .input(createOrgInviteInputSchema)
    .output(createOrgInviteOutputSchema)
    .mutation(async ({ ctx, input }): Promise<CreateOrgInviteResult> => {
      const created = await createPendingOrgInvite({
        organizationName: input.organizationName,
        inviteEmail: input.inviteEmail,
        invitedByUserId: ctx.userId,
      });

      await sendInviteEmail({
        toEmail: created.inviteEmail,
        organizationName: created.organizationName,
        token: created.token,
      });

      return {
        organizationId: created.organizationId,
        organizationName: created.organizationName,
        inviteEmail: created.inviteEmail,
        expiresAt: created.expiresAt,
      };
    }),

  getInfo: publicProcedure
    .input(getInvitationInfoInputSchema)
    .output(getInvitationInfoOutputSchema)
    .query(async ({ input }): Promise<InvitationInfoResult> =>
      getInvitationInfo(input.token),
    ),

  accept: publicProcedure
    .input(acceptOrganizationInvitationInputSchema)
    .output(acceptOrganizationInvitationOutputSchema)
    .mutation(async ({ input }): Promise<AcceptOrganizationInvitationResult> =>
      acceptOrganizationInvitation({
        token: input.token,
        fullName: input.fullName,
        password: input.password,
      }),
    ),

  joinWithToken: authenticatedProcedure
    .input(joinOrgWithTokenInputSchema)
    .output(joinOrgWithTokenOutputSchema)
    .mutation(async ({ ctx, input }) =>
      joinOrganizationWithToken({
        req: ctx.req,
        userId: ctx.userId,
        token: input.token,
      }),
    ),
});

export type InvitationsRouter = typeof invitationsRouter;
