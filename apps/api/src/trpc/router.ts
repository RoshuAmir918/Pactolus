import { router } from "@api/trpc/base";

import { organizationsRouter } from "@api/modules/organizations/router";
import { authRouter } from "@api/modules/auth/router";
import { invitationsRouter } from "@api/modules/invitations/router";
import { ingestionRouter } from "@api/modules/ingestion/router";
import { operationsRouter } from "@api/modules/operations/router";
import { excelRouter } from "@api/modules/excel/router";
import { storageRouter } from "@api/modules/storage/router";
import { chatRouter } from "@api/modules/chat/router";
import { settingsRouter } from "@api/modules/settings/router";

export const appRouter = router({
  auth: authRouter,
  invitations: invitationsRouter,
  organizations: organizationsRouter,
  settings: settingsRouter,
  ingestion: ingestionRouter,
  operations: operationsRouter,
  excel: excelRouter,
  storage: storageRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
