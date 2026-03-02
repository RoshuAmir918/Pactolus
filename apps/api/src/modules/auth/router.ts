import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "@api/trpc/base";


export const authRouter = router({
    me: publicProcedure.query(({ ctx }) => ctx),
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