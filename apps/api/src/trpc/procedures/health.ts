import { publicProcedure, router } from "../base.js";

export const healthRouter = router({
  ping: publicProcedure.query(() => ({
    ok: true,
    service: "pactolus-api",
    timestamp: new Date().toISOString(),
  })),
});
