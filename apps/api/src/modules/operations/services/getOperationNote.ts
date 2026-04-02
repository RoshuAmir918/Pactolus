import { eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { runOperationNotes } from "@db/schema";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type GetOperationNoteInput = {
  orgId: string;
  runId: string;
  operationId: string;
};

export type GetOperationNoteResult = {
  noteText: string | null;
  updatedAt: Date | null;
};

export async function getOperationNote(
  input: GetOperationNoteInput,
): Promise<GetOperationNoteResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const [note] = await db
    .select({ noteText: runOperationNotes.noteText, updatedAt: runOperationNotes.updatedAt })
    .from(runOperationNotes)
    .where(eq(runOperationNotes.runOperationId, input.operationId))
    .limit(1);

  return {
    noteText: note?.noteText ?? null,
    updatedAt: note?.updatedAt ?? null,
  };
}
