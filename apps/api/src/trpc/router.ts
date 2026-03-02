import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "@api/trpc/base";

import { organizationsRouter } from "@api/modules/organizations/router";
import { authRouter } from "@api/modules/auth/router";

export const appRouter = router({
  auth: authRouter,
  organizations: organizationsRouter,
});

export type AppRouter = typeof appRouter;
