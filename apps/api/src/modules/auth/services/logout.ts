import type { Request } from "express";

export async function logoutSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.logout((err: unknown) => {
      if (err) return reject(err);
      req.session.destroy(() => resolve());
    });
  });
}
