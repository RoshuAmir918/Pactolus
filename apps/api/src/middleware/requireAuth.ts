import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.headers["x-user-id"]) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
