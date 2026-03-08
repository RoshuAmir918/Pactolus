import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import passport from "passport";
import type { SessionUser } from "@api/auth/passport";

export async function loginWithPassport(
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
