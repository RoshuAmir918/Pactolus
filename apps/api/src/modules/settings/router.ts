import { adminProcedure, authenticatedProcedure, router } from "@api/trpc/base";
import { cancelOrgMemberInvite } from "@api/modules/settings/services/members/cancelOrgMemberInvite";
import { inviteOrgMember } from "@api/modules/settings/services/members/inviteOrgMember";
import { listOrgMembers } from "@api/modules/settings/services/members/listOrgMembers";
import { removeOrgMember } from "@api/modules/settings/services/members/removeOrgMember";
import { updateMemberRole } from "@api/modules/settings/services/members/updateMemberRole";
import {
  settingsMembersCancelInviteInputSchema,
  settingsMembersInviteInputSchema,
  settingsMembersInviteOutputSchema,
  settingsMembersListOutputSchema,
  settingsMembersRemoveInputSchema,
  settingsMembersUpdateRoleInputSchema,
} from "@api/modules/settings/schemas";

export const settingsRouter = router({
  members: router({
    list: authenticatedProcedure
      .output(settingsMembersListOutputSchema)
      .query(async ({ ctx }) => listOrgMembers(ctx.orgId)),

    invite: adminProcedure
      .input(settingsMembersInviteInputSchema)
      .output(settingsMembersInviteOutputSchema)
      .mutation(async ({ ctx, input }) =>
        inviteOrgMember({
          orgId: ctx.orgId,
          actorUserId: ctx.userId,
          inviteEmail: input.inviteEmail,
          role: input.role,
        }),
      ),

    cancelInvite: adminProcedure
      .input(settingsMembersCancelInviteInputSchema)
      .mutation(async ({ ctx, input }) => {
        await cancelOrgMemberInvite({
          orgId: ctx.orgId,
          invitationId: input.invitationId,
        });
      }),

    remove: adminProcedure
      .input(settingsMembersRemoveInputSchema)
      .mutation(async ({ ctx, input }) => {
        await removeOrgMember({
          orgId: ctx.orgId,
          actorUserId: ctx.userId,
          targetUserId: input.targetUserId,
        });
      }),

    updateRole: adminProcedure
      .input(settingsMembersUpdateRoleInputSchema)
      .mutation(async ({ ctx, input }) => {
        await updateMemberRole({
          orgId: ctx.orgId,
          actorUserId: ctx.userId,
          targetUserId: input.targetUserId,
          role: input.role,
        });
      }),
  }),
});

export type SettingsRouter = typeof settingsRouter;
