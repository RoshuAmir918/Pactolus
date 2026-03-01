import { router } from "./base.js";
import { healthRouter } from "./procedures/health.js";
import { snapshotRouter } from "../modules/snapshot/router.js";

export const appRouter = router({
  health: healthRouter,
  snapshots: snapshotRouter,
});

export type AppRouter = typeof appRouter;
