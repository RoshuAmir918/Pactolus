import { asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperations } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetRunOperationsInput = {
  orgId: string;
  runId: string;
};

export type GetRunOperationsResult = {
  operations: Array<typeof runOperations.$inferSelect>;
};

export async function getRunOperations(
  input: GetRunOperationsInput,
): Promise<GetRunOperationsResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const operations = await db
    .select()
    .from(runOperations)
    .where(eq(runOperations.runId, input.runId))
    .orderBy(asc(runOperations.operationIndex));

  return { operations };
}
