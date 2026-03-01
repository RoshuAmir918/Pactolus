import { TRPCError, initTRPC } from "@trpc/server";
import type { ApiContext } from "../context.js";

const t = initTRPC.context<ApiContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.orgId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "x-org-id header is required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      orgId: ctx.orgId,
    },
  });
});

export const authedTenantProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "x-user-id header is required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
