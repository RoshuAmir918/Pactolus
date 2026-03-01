import type { RequestHandler } from "express";

export function createSessionMiddleware(): RequestHandler {
  return (_req, _res, next) => {
    next();
  };
}
