/**
 * tRPC auth procedures: login, me, logout, adminPing.
 */
import { z } from "zod";
import { loginWithPassport } from "@api/modules/auth/services/login";
import { logoutSession } from "@api/modules/auth/services/logout";
import { publicProcedure, adminProcedure, router } from "@api/trpc/base";

export const authRouter = router({
    login: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const startedAt = Date.now();
            console.log(`[auth.login] start email=${input.email}`);
            try {
                const user = await loginWithPassport(
                    ctx.req,
                    ctx.res,
                    input.email,
                    input.password,
                );
                console.log(
                    `[auth.login] success email=${input.email} userId=${user.userId} orgId=${user.orgId} elapsedMs=${Date.now() - startedAt}`,
                );
                return { ok: true as const, user: { userId: user.userId, orgId: user.orgId, role: user.role } };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.log(
                    `[auth.login] failure email=${input.email} elapsedMs=${Date.now() - startedAt} error=${message}`,
                );
                throw error;
            }
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
