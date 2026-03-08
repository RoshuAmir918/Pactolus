import "dotenv/config";
import cors from "cors";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { mountAuth } from "@api/modules/auth/express";
import { resolveContextOptional } from "@api/auth/context";
import { appRouter } from "@api/trpc/router";

const app = express();

app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

mountAuth(app);

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req, res }) => ({
      req,
      res,
      user: await resolveContextOptional(req),
    }),
  }),
);

const port = 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
