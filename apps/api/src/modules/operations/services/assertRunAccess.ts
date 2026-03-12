import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runs } from "@db/schema";

const { db } = dbClient;

export async function assertRunAccess(input: {
  runId: string;
  orgId: string;
}): Promise<typeof runs.$inferSelect> {
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, input.runId), eq(runs.orgId, input.orgId)))
    .limit(1);

  if (!run) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Run not found for this organization",
    });
  }

  return run;
}
