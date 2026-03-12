import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "@api/trpc/base";

import { organizationsRouter } from "@api/modules/organizations/router";
import { authRouter } from "@api/modules/auth/router";
import { ingestionRouter } from "@api/modules/ingestion/router";
import { operationsRouter } from "@api/modules/operations/router";

export const appRouter = router({
  auth: authRouter,
  organizations: organizationsRouter,
  ingestion: ingestionRouter,
  operations: operationsRouter,
});

export type AppRouter = typeof appRouter;
