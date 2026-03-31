import "dotenv/config";
import cors from "cors";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import dbClient from "@api/db/client";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "@api/auth/passport";
import { resolveContextOptional } from "@api/auth/context";
import { appRouter } from "@api/trpc/router";

const app = express();
const PgSessionStore = connectPgSimple(session);
const sessionSecret =
  process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
const allowedOrigins = new Set([
  process.env.WEB_ORIGIN ?? "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://localhost:3001",
]);

async function ensureSessionTable(): Promise<void> {
  await dbClient.pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
  `);
  await dbClient.pool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire"
    ON "session" ("expire")
  `);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  session({
    store: new PgSessionStore({
      pool: dbClient.pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req, res }) => ({
      req,
      res,
      user: await resolveContextOptional(req),
    }),
    onError({ path, error }) {
      console.error("[tRPC]", path, error.message, error.cause ?? "");
    },
  }),
);

const port = 4000;

async function startServer() {
  await ensureSessionTable();
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
