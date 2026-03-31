import { TRPCError, initTRPC } from "@trpc/server";
import type { RequestContext, TRPCContext } from "@api/auth/context";

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated user; ctx will include userId, orgId, role. */
export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, ...ctx.user } });
});

export const adminProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin role required",
    });
  }
  return next({ ctx });
});

export const superUserProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (!ctx.isSuperUser) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Superuser required",
    });
  }
  return next({ ctx });
});
