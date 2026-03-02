import "dotenv/config";
import cors from "cors";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { resolveContext } from "@api/auth/context";
import { appRouter } from "@api/trpc/router";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req }) =>
      resolveContext(
        req.headers as Record<string, string | string[] | undefined>,
      ),
  }),
);

const port = 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
