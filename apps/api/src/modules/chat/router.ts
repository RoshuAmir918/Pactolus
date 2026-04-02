import { authenticatedProcedure, router } from "@api/trpc/base";
import { sendMessageInputSchema, sendMessageOutputSchema } from "./schemas";
import { sendMessage, type SendMessageResult } from "./services/sendMessage";

export const chatRouter = router({
  sendMessage: authenticatedProcedure
    .input(sendMessageInputSchema)
    .output(sendMessageOutputSchema)
    .mutation(async ({ ctx, input }): Promise<SendMessageResult> =>
      sendMessage({
        orgId: ctx.orgId,
        snapshotId: input.snapshotId,
        runId: input.runId,
        messages: input.messages,
        selectedRange: input.selectedRange,
      }),
    ),
});

export type ChatRouter = typeof chatRouter;
