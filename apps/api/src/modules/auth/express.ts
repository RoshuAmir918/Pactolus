import express from "express";
import session from "express-session";
import passport from "passport";
import "./passport";

const sessionSecret =
  process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

/**
 * Mounts session and passport so tRPC auth procedures (login, me, logout) can use them.
 */
export function mountAuth(app: express.Application): void {
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
}
