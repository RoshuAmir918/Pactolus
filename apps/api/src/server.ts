import cors from "cors";
import express from "express";
import type { Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { env } from "./env.js";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./context.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { createSessionMiddleware } from "./auth/session.js";
import { configurePassport } from "./auth/passport.js";
import { initOpenTelemetry } from "./telemetry/otel.js";

export function createServer(): Express {
  const app = express();

  initOpenTelemetry();
  configurePassport();

  app.use(cors());
  app.use(express.json());
  app.use(createSessionMiddleware());

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "pactolus-api",
    });
  });

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Example protected endpoint for middleware baseline.
  app.get("/me", requireAuth, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
}

export function startServer() {
  const app = createServer();
  app.listen(env.API_PORT, env.API_HOST, () => {
    console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
  });
}
