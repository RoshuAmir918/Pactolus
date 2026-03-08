/**
 * tRPC auth procedures: login, me, logout, adminPing.
 */
import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import passport from "passport";
import { z } from "zod";
import type { SessionUser } from "@api/modules/auth/passport";
import { publicProcedure, adminProcedure, router } from "@api/trpc/base";

function loginWithPassport(
  req: Request,
  res: Response,
  email: string,
  password: string,
): Promise<SessionUser> {
  // Passport LocalStrategy reads from req.body; tRPC sends a JSON-RPC payload, so
  // we must set these so Passport sees the credentials.
  req.body = { ...req.body, email, password };

  return new Promise((resolve, reject) => {
    passport.authenticate(
      "local",
      (
        err: unknown,
        user: SessionUser | false,
        info?: { message?: string },
      ) => {
        if (err) return reject(err);
        if (!user) {
          const message = info?.message ?? "Invalid email or password";
          return reject(
            new TRPCError({
              code: "UNAUTHORIZED",
              message,
            }),
          );
        }
        req.login(user, (loginErr: unknown) => {
          if (loginErr) return reject(loginErr);
          resolve(user);
        });
      },
    )(req, res, (e: unknown) => {
      if (e) reject(e);
    });
  });
}

function logoutSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.logout((err: unknown) => {
      if (err) return reject(err);
      req.session.destroy(() => resolve());
    });
  });
}

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = await loginWithPassport(
        ctx.req,
        ctx.res,
        input.email,
        input.password,
      );
      return { ok: true as const, user: { userId: user.userId, orgId: user.orgId, role: user.role } };
    }),

  me: publicProcedure.query(({ ctx }) => ctx.user),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await logoutSession(ctx.req);
    return { ok: true as const };
  }),

  adminPing: adminProcedure
    .input(
      z
        .object({
          message: z.string().default("ok"),
        })
        .optional(),
    )
    .query(({ input }) => ({
      ok: true,
      message: input?.message ?? "ok",
    })),
});

export type AuthRouter = typeof authRouter;
