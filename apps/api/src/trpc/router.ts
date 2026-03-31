import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "@api/trpc/base";

import { organizationsRouter } from "@api/modules/organizations/router";
import { authRouter } from "@api/modules/auth/router";
import { ingestionRouter } from "@api/modules/ingestion/router";
import { operationsRouter } from "@api/modules/operations/router";
import { contextRouter } from "@api/modules/context/router";
import { excelRouter } from "@api/modules/excel/router";
import { storageRouter } from "@api/modules/storage/router";
import { chatRouter } from "@api/modules/chat/router";

export const appRouter = router({
  auth: authRouter,
  organizations: organizationsRouter,
  ingestion: ingestionRouter,
  operations: operationsRouter,
  context: contextRouter,
  excel: excelRouter,
  storage: storageRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
